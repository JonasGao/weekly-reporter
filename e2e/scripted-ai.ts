import http from 'node:http'

export interface ScriptedAI {
  url: string
  close(): Promise<void>
}

export interface ScriptedToolCall {
  name: string
  arguments: Record<string, unknown>
}

export type ScriptedStep =
  | {
    kind: 'stream'
    reasoning?: string
    text?: string
    toolCalls?: ScriptedToolCall[]
  }
  | {
    kind: 'truncated'
    reasoning?: string
    text?: string
  }
  | {
    kind: 'failure'
    message: string
    status?: number
  }

export interface ScriptedScenario {
  steps: ScriptedStep[]
}

interface OpenAIMessage {
  role?: string
  content?: unknown
  tool_calls?: unknown[]
}

interface OpenAIRequest {
  messages?: OpenAIMessage[]
  stream?: boolean
}

const SCRIPT_MARKER = /\[e2e-script:([A-Za-z0-9_-]+)]/

export const SCRIPTED_AI_PORT = 43191
export const SCRIPTED_AI_URL = `http://127.0.0.1:${SCRIPTED_AI_PORT}/v1`

/** Embeds a stateless provider script in the instruction sent by an E2E test. */
export function scriptedInstruction(instruction: string, scenario: ScriptedScenario): string {
  if (scenario.steps.length === 0) throw new Error('A scripted AI scenario requires at least one step')
  const encoded = Buffer.from(JSON.stringify(scenario)).toString('base64url')
  return `${instruction}\n\n[e2e-script:${encoded}]`
}

function messageText(message: OpenAIMessage): string {
  if (typeof message.content === 'string') return message.content
  if (!Array.isArray(message.content)) return ''
  return message.content.flatMap((part) => {
    if (!part || typeof part !== 'object') return []
    const text = (part as { text?: unknown }).text
    return typeof text === 'string' ? [text] : []
  }).join('')
}

function scriptedStep(input: OpenAIRequest): ScriptedStep | null {
  const messages = input.messages ?? []
  const markerIndex = messages.findIndex((message) => message.role === 'user' && SCRIPT_MARKER.test(messageText(message)))
  if (markerIndex < 0) return null
  const marker = messageText(messages[markerIndex]).match(SCRIPT_MARKER)
  if (!marker) return null

  let scenario: ScriptedScenario
  try {
    scenario = JSON.parse(Buffer.from(marker[1], 'base64url').toString('utf8')) as ScriptedScenario
  } catch {
    throw new Error('Invalid scripted AI scenario encoding')
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    throw new Error('Invalid scripted AI scenario steps')
  }

  const relevant = messages.slice(markerIndex)
  const userTurns = relevant.filter((message) => message.role === 'user').length
  const completedToolSteps = relevant.filter((message) => message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0).length
  const stepIndex = userTurns - 1 + completedToolSteps
  const step = scenario.steps[stepIndex]
  if (!step) throw new Error(`Scripted AI scenario exhausted at step ${stepIndex + 1}`)
  return step
}

const defaultStep: ScriptedStep = {
  kind: 'stream',
  reasoning: '已核对原稿事实。',
  text: '已准备候选终版。',
  toolCalls: [{
    name: 'propose_final_report',
    arguments: {
      content: '# 本周完成\n\n- 完成确定性 E2E 验收\n\n## 下周计划\n\n- 保持验收夹具稳定',
      summary: ['保留原稿事实', '提交完整候选终版'],
    },
  }],
}

/** A tiny OpenAI-compatible protocol boundary used by application E2E tests. */
export async function startScriptedAI(port = 0): Promise<ScriptedAI> {
  const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url?.endsWith('/models')) {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ data: [{ id: 'e2e-scripted' }] }))
      return
    }
    if (request.method !== 'POST' || !request.url?.endsWith('/chat/completions')) {
      response.writeHead(404).end()
      return
    }

    let body = ''
    for await (const chunk of request) body += chunk
    const input = JSON.parse(body) as OpenAIRequest
    if (!input.stream && request.url?.includes('/fail-score/')) {
      response.writeHead(503, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: { message: 'scripted score failure', type: 'server_error' } }))
      return
    }
    let step: ScriptedStep
    try {
      step = scriptedStep(input) ?? defaultStep
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : String(error), type: 'invalid_request_error' } }))
      return
    }

    if (!input.stream) {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({
        choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify({ score: { structure: 90, content: 80, value: 85, overall: 85 }, suggestions: [] }) } }],
      }))
      return
    }
    if (step.kind === 'failure') {
      response.writeHead(step.status ?? 502, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: { message: step.message, type: 'server_error' } }))
      return
    }

    response.statusCode = 200
    response.setHeader('content-type', 'text/event-stream')
    response.setHeader('cache-control', 'no-cache')
    const emit = (value: unknown) => response.write(`data: ${JSON.stringify(value)}\n\n`)
    if (step.reasoning) emit({ choices: [{ index: 0, delta: { role: 'assistant', reasoning_content: step.reasoning } }] })
    if (step.text) emit({ choices: [{ index: 0, delta: { role: 'assistant', content: step.text } }] })
    if (step.kind === 'truncated') {
      response.end()
      return
    }
    if (step.toolCalls?.length) {
      emit({ choices: [{
        index: 0,
        delta: {
          tool_calls: step.toolCalls.map((toolCall, index) => ({
            index,
            id: `e2e-tool-${index + 1}`,
            type: 'function',
            function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) },
          })),
        },
      }] })
      emit({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })
    } else {
      emit({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
    }
    response.write('data: [DONE]\n\n')
    response.end()
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Scripted AI did not bind')
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  }
}
