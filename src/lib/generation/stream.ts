import { streamText, tool, type ModelMessage } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { getAIConfig } from '@/lib/ai/config'
import { createModelFromConfig } from '@/lib/ai/provider'
import { COMPAT_REASONING_END, COMPAT_REASONING_START } from '@/lib/ai/provider'
import { generationSessions, generationTurns, type GenerationProposal, type GenerationSession } from '@/lib/db/schema'
import { getReportBundle } from '@/lib/reports/service'
import { buildModelSystemContext } from './context'
import {
  appendGenerationPart,
  createGenerationProposal,
  finishGenerationTurn,
  GenerationServiceError,
  getGenerationSessionDetail,
  getLatestGenerationProposal,
  startGenerationTurn,
  updateGenerationPart,
} from './service'

export type GenerationStreamEvent =
  | { type: 'start'; turnId: number; protocol: string; model: string }
  | { type: 'working'; label: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-input-delta'; toolName: string }
  | { type: 'tool-call'; toolName: string; toolCallId: string }
  | { type: 'tool-result'; toolName: string; toolCallId: string }
  | { type: 'proposal'; proposal: { id: number; content: string; summary: string[]; status: string; sourceRevision: number; createdAt: Date } }
  | { type: 'finish'; status: 'completed' | 'aborted' }
  | { type: 'error'; message: string }

const activeTurnControllers = new Map<number, AbortController>()

function safeErrorMessage(value: unknown): string {
  if (value instanceof GenerationServiceError) return value.message
  if (value instanceof Error) return value.message
  return String(value)
}

function rawReasoningDelta(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const root = value as Record<string, unknown>
  const choices = Array.isArray(root.choices) ? root.choices : []
  const choice = choices[0]
  if (!choice || typeof choice !== 'object') return null
  const delta = (choice as Record<string, unknown>).delta
  if (!delta || typeof delta !== 'object') return null
  const record = delta as Record<string, unknown>
  for (const key of ['reasoning_content', 'reasoning', 'thinking']) {
    if (typeof record[key] === 'string' && record[key]) return record[key]
  }
  return null
}

function splitCompatibleReasoning(value: string): { reasoning: string; text: string } {
  let remaining = value
  let reasoning = ''
  let text = ''
  while (remaining) {
    const start = remaining.indexOf(COMPAT_REASONING_START)
    if (start < 0) {
      text += remaining
      break
    }
    text += remaining.slice(0, start)
    const reasoningStart = start + COMPAT_REASONING_START.length
    const end = remaining.indexOf(COMPAT_REASONING_END, reasoningStart)
    if (end < 0) {
      // The adapter emits markers in one SSE event, but keep a safe fallback.
      reasoning += remaining.slice(reasoningStart)
      break
    }
    reasoning += remaining.slice(reasoningStart, end)
    remaining = remaining.slice(end + COMPAT_REASONING_END.length)
  }
  return { reasoning, text }
}

function transcriptToModelMessages(detail: NonNullable<Awaited<ReturnType<typeof getGenerationSessionDetail>>>): ModelMessage[] {
  return detail.messages.flatMap((part): ModelMessage[] => {
    if (part.partType !== 'text' || !part.content) return []
    if (part.role === 'user') return [{ role: 'user', content: part.content }]
    if (part.role === 'assistant') return [{ role: 'assistant', content: part.content }]
    return []
  })
}

export async function prepareGenerationTurn(input: {
  reportId: number
  sessionId: number
  userMessage: string
}) {
  const [detail, config, bundle] = await Promise.all([
    getGenerationSessionDetail(input.reportId, input.sessionId),
    getAIConfig(getDb()),
    getReportBundle(input.reportId),
  ])
  if (!detail) throw new GenerationServiceError('生成会话不存在', 'SESSION_NOT_FOUND', 404)
  if (!config) throw new GenerationServiceError('AI_API_KEY 未配置', 'AI_NOT_CONFIGURED', 400)
  if (!bundle) throw new GenerationServiceError('周报不存在', 'REPORT_NOT_FOUND', 404)

  const latestProposal = detail.proposals.at(-1)?.content ?? ''
  const transcriptCharacters = detail.messages.reduce((total, part) => total + (part.content?.length ?? 0), 0)
  const contextCharacters = detail.sourceDraftSnapshot.length
    + detail.templateContent.length
    + detail.systemPrompt.length
    + detail.aiStylePrompt.length
    + detail.toolRules.length
    + (detail.baselineFinalContent?.length ?? 0)
    + latestProposal.length
    + transcriptCharacters
  if (contextCharacters > 450_000) {
    throw new GenerationServiceError('会话上下文接近上限，请从当前终版创建新会话后继续。', 'CONTEXT_LIMIT', 409)
  }

  const turn = startGenerationTurn({ session: detail, config, userMessage: input.userMessage })
  const refreshed = await getGenerationSessionDetail(input.reportId, input.sessionId)
  if (!refreshed) throw new GenerationServiceError('生成会话不存在', 'SESSION_NOT_FOUND', 404)
  return { detail: refreshed, config, bundle, turn }
}

export function stopGenerationTurn(turnId: number): boolean {
  const controller = activeTurnControllers.get(turnId)
  if (controller) {
    controller.abort('user-stop')
    return true
  }
  const turn = getDb().select().from(generationTurns).where(eq(generationTurns.id, turnId)).get()
  return turn?.status === 'working'
}

export function createGenerationEventStream(input: Awaited<ReturnType<typeof prepareGenerationTurn>>, requestSignal?: AbortSignal) {
  const encoder = new TextEncoder()
  const abortController = new AbortController()
  activeTurnControllers.set(input.turn.id, abortController)

  if (requestSignal) {
    if (requestSignal.aborted) abortController.abort(requestSignal.reason)
    else requestSignal.addEventListener('abort', () => abortController.abort(requestSignal.reason), { once: true })
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerationStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      let textContent = ''
      let reasoningContent = ''
      let textPartId: number | null = null
      let reasoningPartId: number | null = null
      let lastTextFlush = 0
      let lastReasoningFlush = 0
      let finalStatus: 'completed' | 'aborted' = 'completed'

      const flushText = (force = false) => {
        if (textPartId == null || (!force && Date.now() - lastTextFlush < 500)) return
        updateGenerationPart(textPartId, textContent)
        lastTextFlush = Date.now()
      }
      const flushReasoning = (force = false) => {
        if (reasoningPartId == null || (!force && Date.now() - lastReasoningFlush < 500)) return
        updateGenerationPart(reasoningPartId, reasoningContent)
        lastReasoningFlush = Date.now()
      }
      const appendText = (text: string) => {
        if (!text) return
        textContent += text
        if (textPartId == null) {
          textPartId = appendGenerationPart({
            sessionId: input.detail.id,
            turnId: input.turn.id,
            role: 'assistant',
            partType: 'text',
            content: textContent,
          }).id
          lastTextFlush = Date.now()
        } else {
          flushText()
        }
        send({ type: 'text-delta', text })
      }
      const appendReasoning = (text: string) => {
        if (!text) return
        reasoningContent += text
        if (reasoningPartId == null) {
          reasoningPartId = appendGenerationPart({
            sessionId: input.detail.id,
            turnId: input.turn.id,
            role: 'assistant',
            partType: 'reasoning',
            content: reasoningContent,
          }).id
          lastReasoningFlush = Date.now()
        } else {
          flushReasoning()
        }
        send({ type: 'reasoning-delta', text })
      }

      try {
        send({ type: 'start', turnId: input.turn.id, protocol: input.config.protocol, model: input.config.model })
        send({ type: 'working', label: 'Working...' })

        const latestProposal = await getLatestGenerationProposal(input.detail.id)
        const system = buildModelSystemContext({
          systemPrompt: input.detail.systemPrompt,
          stylePrompt: input.detail.aiStylePrompt,
          toolRules: input.detail.toolRules,
          variant: input.detail.variant,
          weekStart: input.bundle.weekStart,
          weekEnd: input.bundle.weekEnd,
          templateName: input.detail.templateName,
          templateContent: input.detail.templateContent,
          sourceDraft: input.detail.sourceDraftSnapshot,
          baselineFinalContent: input.detail.baselineFinalContent,
          latestProposalContent: latestProposal?.content,
        })
        const model = createModelFromConfig(input.config)
        const proposalHolder: { current: GenerationProposal | null } = { current: null }
        const result = streamText({
          model,
          system,
          messages: transcriptToModelMessages(input.detail),
          temperature: Number.parseFloat(input.detail.temperature),
          maxOutputTokens: 16_000,
          abortSignal: abortController.signal,
          include: { rawChunks: input.config.protocol === 'openai-compatible' },
          tools: {
            propose_final_report: tool({
              description: '提交一份完整 Markdown 候选终版，供用户在对话外评审和确认。这个工具不会直接保存终版。',
              inputSchema: z.object({
                content: z.string().min(1).describe('完整的 Markdown 周报候选终版'),
                summary: z.array(z.string()).describe('面向用户的简短变更摘要'),
              }),
              execute: async ({ content, summary }) => {
                if (proposalHolder.current) throw new Error('本轮已经提交过候选终版')
                proposalHolder.current = await createGenerationProposal({
                  session: input.detail as GenerationSession,
                  turnId: input.turn.id,
                  content,
                  summary,
                })
                return { proposalId: proposalHolder.current.id, status: 'ready' }
              },
            }),
          },
        })

        for await (const part of result.stream) {
          if (part.type === 'reasoning-delta') {
            appendReasoning(part.text)
          } else if (part.type === 'text-delta') {
            const split = input.config.protocol === 'openai-compatible'
              ? splitCompatibleReasoning(part.text)
              : { reasoning: '', text: part.text }
            appendReasoning(split.reasoning)
            appendText(split.text)
          } else if (part.type === 'raw' && input.config.protocol === 'openai-compatible') {
            const delta = rawReasoningDelta(part.rawValue)
            if (delta) appendReasoning(delta)
          } else if (part.type === 'tool-input-delta') {
            send({ type: 'tool-input-delta', toolName: 'propose_final_report' })
          } else if (part.type === 'tool-call') {
            appendGenerationPart({
              sessionId: input.detail.id,
              turnId: input.turn.id,
              role: 'assistant',
              partType: 'tool-call',
              content: '调用 propose_final_report 提交候选终版',
              data: { toolName: part.toolName, toolCallId: part.toolCallId },
            })
            send({ type: 'tool-call', toolName: part.toolName, toolCallId: part.toolCallId })
          } else if (part.type === 'tool-result') {
            appendGenerationPart({
              sessionId: input.detail.id,
              turnId: input.turn.id,
              role: 'tool',
              partType: 'tool-result',
              content: proposalHolder.current ? '候选终版已提交，等待用户确认。' : '工具调用已完成。',
              data: { toolName: part.toolName, toolCallId: part.toolCallId, proposalId: proposalHolder.current?.id },
            })
            send({ type: 'tool-result', toolName: part.toolName, toolCallId: part.toolCallId })
            if (proposalHolder.current) {
              const proposal = proposalHolder.current
              send({
                type: 'proposal',
                proposal: {
                  id: proposal.id,
                  content: proposal.content,
                  summary: proposal.summary,
                  status: proposal.status,
                  sourceRevision: proposal.sourceRevision,
                  createdAt: proposal.createdAt,
                },
              })
            }
          } else if (part.type === 'abort') {
            finalStatus = 'aborted'
          } else if (part.type === 'error') {
            throw part.error
          }
        }

        flushText(true)
        flushReasoning(true)
        await finishGenerationTurn(input.turn.id, finalStatus)
        send({ type: 'finish', status: finalStatus })
      } catch (streamError) {
        flushText(true)
        flushReasoning(true)
        const aborted = abortController.signal.aborted
        if (aborted) {
          await finishGenerationTurn(input.turn.id, 'aborted')
          send({ type: 'finish', status: 'aborted' })
        } else {
          const message = safeErrorMessage(streamError)
          await finishGenerationTurn(input.turn.id, 'failed', message)
          send({ type: 'error', message })
        }
      } finally {
        activeTurnControllers.delete(input.turn.id)
        controller.close()
      }
    },
    cancel() {
      abortController.abort('stream-cancelled')
    },
  })
}

export async function markTurnStopped(turnId: number) {
  const turn = await getDb().query.generationTurns.findFirst({ where: eq(generationTurns.id, turnId) })
  if (!turn) throw new GenerationServiceError('生成轮次不存在', 'TURN_NOT_FOUND', 404)
  if (turn.status !== 'working') return turn
  stopGenerationTurn(turnId)
  return finishGenerationTurn(turnId, 'aborted')
}

export async function getSessionForReport(reportId: number, sessionId: number) {
  const session = await getDb().query.generationSessions.findFirst({
    where: eq(generationSessions.id, sessionId),
  })
  return session?.reportId === reportId ? session : null
}
