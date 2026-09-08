import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  generationMessageParts,
  generationPlanJudgments,
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
import { isEmptySourceDraft } from '@/lib/reports/source-draft'
import {
  createCarryForwardSnapshot,
  normalizeCarryForwardSnapshot,
  serializeCarryForwardSnapshot,
} from './carry-forward'
import {
  mergeProposalPlan,
  getPlanTemplatePolicy,
  normalizePlanJudgments,
  type PlanJudgmentRecord,
  type ProposalPlanInput,
} from './plan'
import {
  buildPublicGenerationSummary,
  normalizePublicGenerationSummary,
  type PublicGenerationSummaryInput,
} from './public-summary'

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

function persistUncertainPlanJudgments(sessionId: number, turnId: number): void {
  const db = getDb()
  const session = db.select().from(generationSessions).where(eq(generationSessions.id, sessionId)).get()
  if (!session) return
  const snapshot = normalizeCarryForwardSnapshot(session.carryForwardSnapshot)
  if (snapshot.candidates.length === 0) return
  const existing = db.select({ candidateId: generationPlanJudgments.candidateId })
    .from(generationPlanJudgments).where(eq(generationPlanJudgments.sessionId, sessionId)).all()
  const seen = new Set(existing.map((item) => item.candidateId))
  const now = new Date()
  for (const candidate of snapshot.candidates) {
    if (seen.has(candidate.candidateId)) continue
    db.insert(generationPlanJudgments).values({
      sessionId,
      candidateId: candidate.candidateId,
      judgment: 'uncertain',
      reason: '本轮超时、失败或部分返回，未能可靠判断；默认不自动结转。',
      remainingAction: null,
      turnId,
      createdAt: now,
    }).run()
  }
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
  if (!bundle) error('Report not found', 'REPORT_NOT_FOUND', 404)
  if (!template) error('Template not found', 'TEMPLATE_NOT_FOUND', 404)

  const reportVariant = bundle.variants.find((item) => item.variant === input.variant)
  if (!reportVariant) error('Report variant not found', 'VARIANT_NOT_FOUND', 404)
  if (reportVariant.sourceRevision === 0 || isEmptySourceDraft(reportVariant.sourceDraft)) {
    error('No events are available to generate the final report', 'EMPTY_SOURCE_DRAFT', 400)
  }

  const styleKey = input.styleOverride || template.aiStyle || 'formal'
  const style = await getAIStyle(styleKey)
  const now = new Date()
  const carryForwardSnapshot = await createCarryForwardSnapshot(bundle, input.variant, now)
  const timeLabel = new Intl.DateTimeFormat(undefined, {
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
      planPolicy: getPlanTemplatePolicy(template.content),
      baselineFinalContent: reportVariant.finalContent,
      carryForwardSnapshot: serializeCarryForwardSnapshot(carryForwardSnapshot),
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
    return {
      ...session,
      carryForwardSnapshot: normalizeCarryForwardSnapshot(session.carryForwardSnapshot),
      latestTurn: latestTurn[0] ?? null,
      latestProposal: latestProposal[0] ? {
        ...latestProposal[0],
        publicSummary: normalizePublicGenerationSummary(latestProposal[0].publicSummary),
      } : null,
    }
  }))
}

export async function getGenerationSessionDetail(reportId: number, sessionId: number) {
  const db = getDb()
  const session = await db.query.generationSessions.findFirst({
    where: and(eq(generationSessions.id, sessionId), eq(generationSessions.reportId, reportId)),
  })
  if (!session) return null

  const [messages, turns, proposals, currentVariant, planJudgments] = await Promise.all([
    db.select().from(generationMessageParts).where(eq(generationMessageParts.sessionId, sessionId)).orderBy(asc(generationMessageParts.sequence)),
    db.select().from(generationTurns).where(eq(generationTurns.sessionId, sessionId)).orderBy(asc(generationTurns.id)),
    db.select().from(generationProposals).where(eq(generationProposals.sessionId, sessionId)).orderBy(asc(generationProposals.id)),
    db.query.reportVariants.findFirst({ where: eq(reportVariants.id, session.reportVariantId) }),
    db.select().from(generationPlanJudgments).where(eq(generationPlanJudgments.sessionId, sessionId)).orderBy(asc(generationPlanJudgments.id)),
  ])

  return {
    ...session,
    carryForwardSnapshot: normalizeCarryForwardSnapshot(session.carryForwardSnapshot),
    messages,
    turns,
    proposals: proposals.map((proposal) => ({
      ...proposal,
      publicSummary: normalizePublicGenerationSummary(proposal.publicSummary),
    })),
    planJudgments,
    sourceIsCurrent: currentVariant?.sourceRevision === session.sourceRevision,
    activeTurn: turns.find((turn) => turn.status === 'working') ?? null,
  }
}

export async function renameGenerationSession(reportId: number, sessionId: number, title: string) {
  const trimmed = title.trim()
  if (!trimmed) error('Session title is required', 'INVALID_TITLE', 400)
  const updated = await getDb().update(generationSessions).set({
    title: trimmed.slice(0, 120),
    updatedAt: new Date(),
  }).where(and(eq(generationSessions.id, sessionId), eq(generationSessions.reportId, reportId))).returning()
  if (!updated[0]) error('Generation session not found', 'SESSION_NOT_FOUND', 404)
  return updated[0]
}

export async function archiveGenerationSession(reportId: number, sessionId: number) {
  const db = getDb()
  const working = await db.query.generationTurns.findFirst({
    where: and(eq(generationTurns.sessionId, sessionId), eq(generationTurns.status, 'working')),
  })
  if (working) error('AI is still generating; stop the current turn first', 'TURN_IN_PROGRESS', 409)
  const now = new Date()
  const updated = await db.update(generationSessions).set({ status: 'archived', archivedAt: now, updatedAt: now })
    .where(and(eq(generationSessions.id, sessionId), eq(generationSessions.reportId, reportId))).returning()
  if (!updated[0]) error('Generation session not found', 'SESSION_NOT_FOUND', 404)
  return updated[0]
}

export function startGenerationTurn(input: {
  session: GenerationSession
  config: AIConfig
  userMessage: string
}) {
  const userMessage = input.userMessage.trim()
  if (!userMessage) error('Message is required', 'EMPTY_MESSAGE', 400)
  if (input.session.status !== 'active') error('Session is archived', 'SESSION_ARCHIVED', 409)

  const db = getDb()
  const now = new Date()
  return db.transaction((tx) => {
    const currentVariant = tx.select().from(reportVariants).where(eq(reportVariants.id, input.session.reportVariantId)).get()
    if (!currentVariant || currentVariant.sourceRevision !== input.session.sourceRevision) {
      error('The source draft has changed; start a new session', 'SOURCE_REVISION_CONFLICT', 409)
    }
    const active = tx.select().from(generationTurns).where(
      and(eq(generationTurns.sessionId, input.session.id), eq(generationTurns.status, 'working')),
    ).get()
    if (active) error('This session already has a turn in progress', 'TURN_IN_PROGRESS', 409)

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

export async function finishGenerationTurn(turnId: number, status: 'completed' | 'failed' | 'aborted', errorMessage?: string, partial = false) {
  const db = getDb()
  const turn = await db.query.generationTurns.findFirst({ where: eq(generationTurns.id, turnId) })
  if (!turn) return null
  if (partial || status === 'failed' || status === 'aborted') persistUncertainPlanJudgments(turn.sessionId, turnId)
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
      content: status === 'completed' ? 'Completed' : status === 'aborted' ? 'Stopped' : 'Generation failed',
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
  publicSummary?: PublicGenerationSummaryInput
  plan?: ProposalPlanInput
}): Promise<GenerationProposal> {
  const content = input.content.trim()
  const summary = input.summary.map((item) => item.trim()).filter(Boolean)
  if (!content) error('Proposal content is required', 'EMPTY_PROPOSAL', 400)
  if (content.length > MAX_PROPOSAL_CHARACTERS) error('Proposal content is too long', 'PROPOSAL_TOO_LARGE', 400)

  const db = getDb()
  return db.transaction((tx) => {
    const storedSession = tx.select().from(generationSessions).where(eq(generationSessions.id, input.session.id)).get()
    if (!storedSession) error('Generation session not found', 'SESSION_NOT_FOUND', 404)
    const currentVariant = tx.select().from(reportVariants).where(eq(reportVariants.id, storedSession.reportVariantId)).get()
    if (!currentVariant || currentVariant.sourceRevision !== storedSession.sourceRevision) {
      error('The source draft changed; this proposal is based on an older version', 'SOURCE_REVISION_CONFLICT', 409)
    }
    const turn = tx.select().from(generationTurns).where(eq(generationTurns.id, input.turnId)).get()
    if (!turn || turn.sessionId !== storedSession.id || turn.status !== 'working') {
      error('The current generation turn has ended', 'TURN_NOT_ACTIVE', 409)
    }
    const existingForTurn = tx.select().from(generationProposals).where(eq(generationProposals.turnId, input.turnId)).get()
    if (existingForTurn) error('Only one proposal may be submitted per turn', 'PROPOSAL_LIMIT', 409)

    const snapshot = normalizeCarryForwardSnapshot(storedSession.carryForwardSnapshot)
    const existingJudgmentRows = tx.select().from(generationPlanJudgments)
      .where(eq(generationPlanJudgments.sessionId, storedSession.id)).orderBy(asc(generationPlanJudgments.id)).all()
    const existingJudgments: PlanJudgmentRecord[] = existingJudgmentRows.map((row) => ({
      candidateId: row.candidateId,
      judgment: row.judgment,
      reason: row.reason,
      remainingAction: row.remainingAction,
    }))
    const normalizedJudgments = existingJudgments.length > 0
      ? existingJudgments
      : normalizePlanJudgments(snapshot, input.plan)
    if (existingJudgmentRows.length === 0) {
      for (const judgment of normalizedJudgments) {
        tx.insert(generationPlanJudgments).values({
          sessionId: storedSession.id,
          candidateId: judgment.candidateId,
          judgment: judgment.judgment,
          reason: judgment.reason,
          remainingAction: judgment.remainingAction,
          turnId: input.turnId,
          createdAt: new Date(),
        }).run()
      }
    }
    const merged = mergeProposalPlan({
      content,
      templateContent: storedSession.templateContent,
      snapshot,
      plan: input.plan,
      baselineFinalContent: storedSession.baselineFinalContent,
      existingJudgments: normalizedJudgments,
    })
    const planSummary = merged.state.status === 'forbidden'
      ? '模板约束：章节禁止'
      : merged.state.status === 'empty'
        ? '下周计划：无可用事项，保留明确空计划表达'
        : `下周计划：应用 ${merged.state.items.length} 项，${merged.state.judgments.filter((item) => item.judgment === 'carry').length} 项 carry、${merged.state.judgments.filter((item) => item.judgment === 'uncertain').length} 项 uncertain`
    const effectiveSummary = [...summary, planSummary, ...merged.state.warnings].filter(Boolean).slice(0, 8)
    const templatePolicy = storedSession.planPolicy ?? getPlanTemplatePolicy(storedSession.templateContent)
    const publicSummary = buildPublicGenerationSummary({
      explicit: input.publicSummary,
      changeSummary: summary,
      planState: merged.state,
      carryForwardSnapshot: snapshot,
      templatePolicy,
      proposalPlanParseFailure: merged.proposalPlanParseFailure,
    })
    tx.update(generationProposals).set({ status: 'superseded' })
      .where(and(eq(generationProposals.sessionId, storedSession.id), eq(generationProposals.status, 'pending'))).run()
    return tx.insert(generationProposals).values({
      sessionId: storedSession.id,
      turnId: input.turnId,
      content: merged.content,
      summary: effectiveSummary,
      sourceRevision: storedSession.sourceRevision,
      status: 'pending',
      planState: merged.state as unknown as Record<string, unknown>,
      publicSummary: publicSummary as unknown as Record<string, unknown>,
      baselineContent: storedSession.baselineFinalContent ?? '',
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
    if (!session) error('Generation session not found', 'SESSION_NOT_FOUND', 404)
    const proposal = tx.select().from(generationProposals).where(
      and(eq(generationProposals.id, input.proposalId), eq(generationProposals.sessionId, input.sessionId)),
    ).get()
    if (!proposal) error('Proposal not found', 'PROPOSAL_NOT_FOUND', 404)
    if (proposal.status === 'superseded') error('This proposal has been superseded', 'PROPOSAL_SUPERSEDED', 409)
    const currentVariant = tx.select().from(reportVariants).where(eq(reportVariants.id, session.reportVariantId)).get()
    if (!currentVariant || currentVariant.sourceRevision !== session.sourceRevision || proposal.sourceRevision !== session.sourceRevision) {
      error('The source draft changed; start a new session from the latest draft', 'SOURCE_REVISION_CONFLICT', 409)
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
