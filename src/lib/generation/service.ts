import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  generationMessageParts,
  generationProposals,
  generationSessions,
  generationTurns,
  reportVariants,
  reports,
  type AIConfig,
  type AudienceVariant,
  type GenerationMessagePartType,
  type GenerationMessageRole,
  type GenerationProposal,
  type GenerationSession,
} from '@/lib/db/schema'
import { getSystemPrompt } from '@/lib/ai'
import { getAIStyle } from '@/lib/ai/styles'
import { getTemplateSelection, getReportBundle } from '@/lib/reports/service'
import { triggerAsyncVariantScoring } from '@/lib/scoring'
import {
  buildEffectiveGenerationSystemPrompt,
  buildSourceOverview,
  FINAL_REPORT_TOOL_RULES,
} from './context'

const MAX_PROPOSAL_CHARACTERS = 200_000

export class GenerationServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'GenerationServiceError'
  }
}

function error(message: string, code: string, status: number): never {
  throw new GenerationServiceError(message, code, status)
}

function nextSequence(sessionId: number): number {
  const db = getDb()
  const row = db.select({ value: sql<number>`coalesce(max(${generationMessageParts.sequence}), 0)` })
    .from(generationMessageParts)
    .where(eq(generationMessageParts.sessionId, sessionId))
    .get()
  return Number(row?.value ?? 0) + 1
}

export function appendGenerationPart(input: {
  sessionId: number
  turnId?: number | null
  role: GenerationMessageRole
  partType: GenerationMessagePartType
  content?: string | null
  data?: Record<string, unknown> | null
}) {
  const db = getDb()
  return db.insert(generationMessageParts).values({
    sessionId: input.sessionId,
    turnId: input.turnId ?? null,
    sequence: nextSequence(input.sessionId),
    role: input.role,
    partType: input.partType,
    content: input.content ?? null,
    data: input.data ?? null,
    createdAt: new Date(),
  }).returning().get()
}

export function updateGenerationPart(id: number, content: string) {
  return getDb().update(generationMessageParts)
    .set({ content })
    .where(eq(generationMessageParts.id, id))
    .returning()
    .get()
}

export async function createGenerationSession(input: {
  reportId: number
  variant: AudienceVariant
  templateId: string
  styleOverride?: string
}): Promise<GenerationSession> {
  const [bundle, template, basePrompt] = await Promise.all([
    getReportBundle(input.reportId),
    getTemplateSelection(input.templateId),
    getSystemPrompt('generate'),
  ])
  if (!bundle) error('周报不存在', 'REPORT_NOT_FOUND', 404)
  if (!template) error('模板不存在', 'TEMPLATE_NOT_FOUND', 404)

  const reportVariant = bundle.variants.find((item) => item.variant === input.variant)
  if (!reportVariant) error('周报版本不存在', 'VARIANT_NOT_FOUND', 404)
  if (reportVariant.sourceRevision === 0 || reportVariant.sourceDraft === '- 本周暂无事件') {
    error('没有可用于生成终版的事件', 'EMPTY_SOURCE_DRAFT', 400)
  }

  const styleKey = input.styleOverride || template.aiStyle || 'formal'
  const style = await getAIStyle(styleKey)
  const now = new Date()
  const timeLabel = new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
  const db = getDb()

  return db.transaction((tx) => {
    const session = tx.insert(generationSessions).values({
      reportId: input.reportId,
      reportVariantId: reportVariant.id,
      variant: input.variant,
      title: `${template.name} · ${timeLabel}`,
      status: 'active',
      sourceRevision: reportVariant.sourceRevision,
      sourceDraftSnapshot: reportVariant.sourceDraft,
      sourceOverview: buildSourceOverview(reportVariant.sourceDraft, input.variant),
      templateId: template.id,
      templateName: template.name,
      templateContent: template.content,
      aiStyleKey: styleKey,
      aiStyleLabel: style.label,
      aiStylePrompt: style.systemPrompt,
      temperature: String(style.temperature),
      systemPrompt: buildEffectiveGenerationSystemPrompt(basePrompt),
      toolRules: FINAL_REPORT_TOOL_RULES,
      baselineFinalContent: reportVariant.finalContent,
      createdAt: now,
      updatedAt: now,
    }).returning().get()

    tx.insert(generationMessageParts).values([
      { sessionId: session.id, turnId: null, sequence: 1, role: 'system', partType: 'system-prompt', content: session.systemPrompt, createdAt: now },
      { sessionId: session.id, turnId: null, sequence: 2, role: 'system', partType: 'style-prompt', content: session.aiStylePrompt, data: { key: session.aiStyleKey, label: session.aiStyleLabel }, createdAt: now },
      { sessionId: session.id, turnId: null, sequence: 3, role: 'system', partType: 'tool-rules', content: session.toolRules, createdAt: now },
      { sessionId: session.id, turnId: null, sequence: 4, role: 'system', partType: 'source-overview', content: session.sourceOverview, createdAt: now },
    ]).run()

    return session
  })
}

export async function listGenerationSessions(reportId: number, variant?: AudienceVariant) {
  const db = getDb()
  const rows = await db.select().from(generationSessions)
    .where(variant
      ? and(eq(generationSessions.reportId, reportId), eq(generationSessions.variant, variant))
      : eq(generationSessions.reportId, reportId))
    .orderBy(desc(generationSessions.updatedAt))

  return Promise.all(rows.map(async (session) => {
    const [latestTurn, latestProposal] = await Promise.all([
      db.select().from(generationTurns).where(eq(generationTurns.sessionId, session.id)).orderBy(desc(generationTurns.id)).limit(1),
      db.select().from(generationProposals).where(eq(generationProposals.sessionId, session.id)).orderBy(desc(generationProposals.id)).limit(1),
    ])
    return { ...session, latestTurn: latestTurn[0] ?? null, latestProposal: latestProposal[0] ?? null }
  }))
}

export async function getGenerationSessionDetail(reportId: number, sessionId: number) {
  const db = getDb()
  const session = await db.query.generationSessions.findFirst({
    where: and(eq(generationSessions.id, sessionId), eq(generationSessions.reportId, reportId)),
  })
  if (!session) return null

  const [messages, turns, proposals, currentVariant] = await Promise.all([
    db.select().from(generationMessageParts).where(eq(generationMessageParts.sessionId, sessionId)).orderBy(asc(generationMessageParts.sequence)),
    db.select().from(generationTurns).where(eq(generationTurns.sessionId, sessionId)).orderBy(asc(generationTurns.id)),
    db.select().from(generationProposals).where(eq(generationProposals.sessionId, sessionId)).orderBy(asc(generationProposals.id)),
    db.query.reportVariants.findFirst({ where: eq(reportVariants.id, session.reportVariantId) }),
  ])

  return {
    ...session,
    messages,
    turns,
    proposals,
    sourceIsCurrent: currentVariant?.sourceRevision === session.sourceRevision,
    activeTurn: turns.find((turn) => turn.status === 'working') ?? null,
  }
}

export async function renameGenerationSession(reportId: number, sessionId: number, title: string) {
  const trimmed = title.trim()
  if (!trimmed) error('会话标题不能为空', 'INVALID_TITLE', 400)
  const updated = await getDb().update(generationSessions).set({
    title: trimmed.slice(0, 120),
    updatedAt: new Date(),
  }).where(and(eq(generationSessions.id, sessionId), eq(generationSessions.reportId, reportId))).returning()
  if (!updated[0]) error('生成会话不存在', 'SESSION_NOT_FOUND', 404)
  return updated[0]
}

export async function archiveGenerationSession(reportId: number, sessionId: number) {
  const db = getDb()
  const working = await db.query.generationTurns.findFirst({
    where: and(eq(generationTurns.sessionId, sessionId), eq(generationTurns.status, 'working')),
  })
  if (working) error('AI 仍在生成，请先停止当前轮次', 'TURN_IN_PROGRESS', 409)
  const now = new Date()
  const updated = await db.update(generationSessions).set({ status: 'archived', archivedAt: now, updatedAt: now })
    .where(and(eq(generationSessions.id, sessionId), eq(generationSessions.reportId, reportId))).returning()
  if (!updated[0]) error('生成会话不存在', 'SESSION_NOT_FOUND', 404)
  return updated[0]
}

export function startGenerationTurn(input: {
  session: GenerationSession
  config: AIConfig
  userMessage: string
}) {
  const userMessage = input.userMessage.trim()
  if (!userMessage) error('消息不能为空', 'EMPTY_MESSAGE', 400)
  if (input.session.status !== 'active') error('会话已归档', 'SESSION_ARCHIVED', 409)

  const db = getDb()
  const now = new Date()
  return db.transaction((tx) => {
    const currentVariant = tx.select().from(reportVariants).where(eq(reportVariants.id, input.session.reportVariantId)).get()
    if (!currentVariant || currentVariant.sourceRevision !== input.session.sourceRevision) {
      error('原稿已更新，请开启新会话', 'SOURCE_REVISION_CONFLICT', 409)
    }
    const active = tx.select().from(generationTurns).where(
      and(eq(generationTurns.sessionId, input.session.id), eq(generationTurns.status, 'working')),
    ).get()
    if (active) error('当前会话已有生成中的轮次', 'TURN_IN_PROGRESS', 409)

    const turn = tx.insert(generationTurns).values({
      sessionId: input.session.id,
      status: 'working',
      protocol: input.config.protocol,
      model: input.config.model,
      reasoningEffort: null,
      createdAt: now,
    }).returning().get()
    const sequence = tx.select({ value: sql<number>`coalesce(max(${generationMessageParts.sequence}), 0)` })
      .from(generationMessageParts).where(eq(generationMessageParts.sessionId, input.session.id)).get()
    const next = Number(sequence?.value ?? 0) + 1
    tx.insert(generationMessageParts).values([
      { sessionId: input.session.id, turnId: turn.id, sequence: next, role: 'user', partType: 'text', content: userMessage, createdAt: now },
      { sessionId: input.session.id, turnId: turn.id, sequence: next + 1, role: 'application', partType: 'status', content: 'Working...', data: { status: 'working' }, createdAt: now },
    ]).run()
    tx.update(generationSessions).set({ updatedAt: now }).where(eq(generationSessions.id, input.session.id)).run()
    return turn
  })
}

export async function finishGenerationTurn(turnId: number, status: 'completed' | 'failed' | 'aborted', errorMessage?: string) {
  const db = getDb()
  const turn = await db.query.generationTurns.findFirst({ where: eq(generationTurns.id, turnId) })
  if (!turn) return null
  const now = new Date()
  const updated = await db.update(generationTurns).set({
    status,
    error: errorMessage ?? null,
    finishedAt: now,
  }).where(eq(generationTurns.id, turnId)).returning()
  await db.update(generationSessions).set({ updatedAt: now }).where(eq(generationSessions.id, turn.sessionId))
  const statusPart = await db.query.generationMessageParts.findFirst({
    where: and(
      eq(generationMessageParts.turnId, turnId),
      eq(generationMessageParts.partType, 'status'),
    ),
  })
  if (statusPart) {
    await db.update(generationMessageParts).set({
      content: status === 'completed' ? '完成' : status === 'aborted' ? '已停止' : '生成失败',
      data: { status },
    }).where(eq(generationMessageParts.id, statusPart.id))
  }
  if (errorMessage) {
    appendGenerationPart({ sessionId: turn.sessionId, turnId, role: 'application', partType: 'error', content: errorMessage })
  }
  return updated[0] ?? null
}

export async function createGenerationProposal(input: {
  session: GenerationSession
  turnId: number
  content: string
  summary: string[]
}): Promise<GenerationProposal> {
  const content = input.content.trim()
  const summary = input.summary.map((item) => item.trim()).filter(Boolean)
  if (!content) error('候选终版不能为空', 'EMPTY_PROPOSAL', 400)
  if (content.length > MAX_PROPOSAL_CHARACTERS) error('候选终版内容过长', 'PROPOSAL_TOO_LARGE', 400)

  const db = getDb()
  return db.transaction((tx) => {
    const currentVariant = tx.select().from(reportVariants).where(eq(reportVariants.id, input.session.reportVariantId)).get()
    if (!currentVariant || currentVariant.sourceRevision !== input.session.sourceRevision) {
      error('原稿已更新，不能提交基于旧原稿的候选终版', 'SOURCE_REVISION_CONFLICT', 409)
    }
    const turn = tx.select().from(generationTurns).where(eq(generationTurns.id, input.turnId)).get()
    if (!turn || turn.sessionId !== input.session.id || turn.status !== 'working') {
      error('当前生成轮次已结束', 'TURN_NOT_ACTIVE', 409)
    }
    const existingForTurn = tx.select().from(generationProposals).where(eq(generationProposals.turnId, input.turnId)).get()
    if (existingForTurn) error('每轮最多提交一个候选终版', 'PROPOSAL_LIMIT', 409)

    tx.update(generationProposals).set({ status: 'superseded' })
      .where(and(eq(generationProposals.sessionId, input.session.id), eq(generationProposals.status, 'pending'))).run()
    return tx.insert(generationProposals).values({
      sessionId: input.session.id,
      turnId: input.turnId,
      content,
      summary,
      sourceRevision: input.session.sourceRevision,
      status: 'pending',
      createdAt: new Date(),
    }).returning().get()
  })
}

export async function getLatestGenerationProposal(sessionId: number) {
  const rows = await getDb().select().from(generationProposals)
    .where(eq(generationProposals.sessionId, sessionId))
    .orderBy(desc(generationProposals.id)).limit(1)
  return rows[0] ?? null
}

export async function acceptGenerationProposal(input: {
  reportId: number
  sessionId: number
  proposalId: number
}) {
  const db = getDb()
  const now = new Date()
  const accepted = db.transaction((tx) => {
    const session = tx.select().from(generationSessions).where(
      and(eq(generationSessions.id, input.sessionId), eq(generationSessions.reportId, input.reportId)),
    ).get()
    if (!session) error('生成会话不存在', 'SESSION_NOT_FOUND', 404)
    const proposal = tx.select().from(generationProposals).where(
      and(eq(generationProposals.id, input.proposalId), eq(generationProposals.sessionId, input.sessionId)),
    ).get()
    if (!proposal) error('候选终版不存在', 'PROPOSAL_NOT_FOUND', 404)
    if (proposal.status === 'superseded') error('该候选终版已被更新版本替代', 'PROPOSAL_SUPERSEDED', 409)
    const currentVariant = tx.select().from(reportVariants).where(eq(reportVariants.id, session.reportVariantId)).get()
    if (!currentVariant || currentVariant.sourceRevision !== session.sourceRevision || proposal.sourceRevision !== session.sourceRevision) {
      error('原稿已更新，请基于最新原稿开启新会话', 'SOURCE_REVISION_CONFLICT', 409)
    }

    const updatedVariant = tx.update(reportVariants).set({
      finalContent: proposal.content,
      finalStatus: 'current',
      templateId: session.templateId,
      templateName: session.templateName,
      templateContent: session.templateContent,
      aiStyle: session.aiStyleKey,
      acceptedProposalId: proposal.id,
      scoreStatus: 'pending',
      scoreStructure: null,
      scoreContent: null,
      scoreValue: null,
      scoreOverall: null,
      suggestions: null,
      scoreError: null,
      scoredAt: null,
      updatedAt: now,
    }).where(eq(reportVariants.id, currentVariant.id)).returning().get()
    tx.update(generationProposals).set({ status: 'accepted', acceptedAt: now }).where(eq(generationProposals.id, proposal.id)).run()
    if (session.variant === 'personal') {
      tx.update(reports).set({ content: proposal.content, updatedAt: now }).where(eq(reports.id, input.reportId)).run()
    }
    tx.update(generationSessions).set({ baselineFinalContent: proposal.content, updatedAt: now }).where(eq(generationSessions.id, session.id)).run()
    const sequence = tx.select({ value: sql<number>`coalesce(max(${generationMessageParts.sequence}), 0)` })
      .from(generationMessageParts).where(eq(generationMessageParts.sessionId, session.id)).get()
    tx.insert(generationMessageParts).values({
      sessionId: session.id,
      turnId: null,
      sequence: Number(sequence?.value ?? 0) + 1,
      role: 'application',
      partType: 'proposal-accepted',
      content: '用户已确认并保存该候选终版。',
      data: { proposalId: proposal.id },
      createdAt: now,
    }).run()
    return { session, proposal: { ...proposal, status: 'accepted' as const, acceptedAt: now }, variant: updatedVariant }
  })

  triggerAsyncVariantScoring(accepted.variant.id).catch((scoringError) => {
    console.error('[generation] Variant scoring failed:', scoringError)
  })
  return accepted
}
