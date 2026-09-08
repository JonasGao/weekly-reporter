import { parseNextWeekPlan } from '@/lib/reports/next-week-plan'
import { nextWeekPlanPolicy } from '@/lib/reports/structure-completeness'
import type { CarryForwardSnapshot } from './carry-forward-snapshot'

export type PlanJudgment = 'carry' | 'drop' | 'uncertain'
export type PlanSource = 'user-goal' | 'carry-forward' | 'current-fact' | 'baseline'
export type PlanOverrideAction = 'keep' | 'drop' | 'rewrite' | 're-add'
export type PlanOverrideSource = 'carry-forward' | 'this-week-new'
export type PlanItemPublicSource = 'carry-forward' | 'this-week-new' | 'user-rewrite' | 're-add' | 'editing-baseline'

export interface PlanOverrideRecord {
  id: number
  itemId: string
  action: PlanOverrideAction
  replacementText: string | null
  source: PlanOverrideSource
  createdAt: Date | string
}

export interface PlanOverrideConclusion {
  itemId: string
  action: PlanOverrideAction
  result: 'included' | 'excluded'
  replacementText: string | null
  source: PlanOverrideSource
}

export interface PlanJudgmentInput {
  candidateId: string
  judgment: PlanJudgment
  reason: string
  remainingAction?: string
}

export interface PlanItemInput {
  text: string
  source: PlanSource
  candidateId?: string
  reason?: string
}

export interface ProposalPlanInput {
  judgments?: PlanJudgmentInput[]
  items?: PlanItemInput[]
}

export interface PlanJudgmentRecord {
  candidateId: string
  judgment: PlanJudgment
  reason: string
  remainingAction: string | null
}

export interface PlanState {
  version: 1
  status: 'included' | 'empty' | 'forbidden'
  section: 'present' | 'appended' | 'omitted'
  items: Array<{
    text: string
    source: PlanSource
    candidateId: string | null
    itemId: string | null
    publicSource: PlanItemPublicSource
  }>
  judgments: PlanJudgmentRecord[]
  overrideConclusions: PlanOverrideConclusion[]
  truncatedCount: number
  warnings: string[]
}

const MAX_PLAN_ITEMS = 5
const PLAN_TITLE = '下周计划'
const HEADING = /^( {0,3})(#{2,3})(?:[ \t]+|$)(.*?)[ \t]*#*[ \t]*$/

interface PlanSectionRange {
  headingIndex: number
  end: number
}

interface ResolvedOverride {
  latest: PlanOverrideRecord
  baseText: string
  effectiveText: string | null
  publicSource: Extract<PlanItemPublicSource, 'carry-forward' | 'this-week-new' | 'user-rewrite' | 're-add'>
  lastRewrite: string | null
}

export interface PlanOverrideItemState {
  itemId: string
  source: PlanOverrideSource
  originalText: string
  effectiveText: string | null
  latestAction: PlanOverrideAction
  included: boolean
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function cleanText(value: string): string {
  return value.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').replace(/\s+/g, ' ').trim()
}

export function getPlanTemplatePolicy(template: string): 'forbidden' | 'required' {
  return nextWeekPlanPolicy(template)
}

function findPlanSection(content: string): PlanSectionRange | null {
  const lines = content.split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => {
    const match = line.match(HEADING)
    return Boolean(match && match[3].trim().toLocaleLowerCase() === PLAN_TITLE.toLocaleLowerCase())
  })
  if (headingIndex < 0) return null
  const headingLevel = lines[headingIndex].match(HEADING)?.[2].length ?? 2
  let end = headingIndex + 1
  while (end < lines.length) {
    const match = lines[end].match(HEADING)
    if (match && match[2].length <= headingLevel) break
    end += 1
  }
  return { headingIndex, end }
}

function replacePlanSection(content: string, items: string[]): string {
  const lines = content.split(/\r?\n/)
  const body = items.length > 0 ? items.map((item) => `- ${item}`) : ['（暂无可用的下周计划事项）']
  const section = findPlanSection(content)
  if (!section) {
    const prefix = content.trimEnd()
    return `${prefix}${prefix ? '\n\n' : ''}## ${PLAN_TITLE}\n${body.join('\n')}`
  }
  const heading = lines[section.headingIndex]
  lines.splice(section.headingIndex, section.end - section.headingIndex, heading, ...body)
  return lines.join('\n').trimEnd()
}

function removePlanSection(content: string): string {
  const lines = content.split(/\r?\n/)
  const section = findPlanSection(content)
  if (!section) return content.trimEnd()
  const before = lines.slice(0, section.headingIndex)
  const after = lines.slice(section.end)
  return [...before, ...after].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

function defaultJudgmentReason(judgment: PlanJudgment): string {
  if (judgment === 'carry') return '保留上一周期尚未完成的计划事项。'
  if (judgment === 'drop') return '上一周期事项已完成或不再适用。'
  return '本轮未可靠判断，默认不自动结转。'
}

function resolveOverrides(snapshot: CarryForwardSnapshot, records: PlanOverrideRecord[]): Map<string, ResolvedOverride> {
  const candidateText = new Map(snapshot.candidates.map((candidate) => [candidate.candidateId, candidate.text]))
  const resolved = new Map<string, ResolvedOverride>()
  for (const record of records) {
    const existing = resolved.get(record.itemId)
    const baseText = existing?.baseText
      ?? candidateText.get(record.itemId)
      ?? record.replacementText
      ?? ''
    const lastRewrite = record.action === 'rewrite' && record.replacementText
      ? record.replacementText
      : existing?.lastRewrite ?? null
    const effectiveText = record.action === 'drop'
      ? null
      : record.action === 'rewrite'
        ? record.replacementText
        : record.action === 're-add'
          ? lastRewrite || baseText
          : baseText
    const publicSource = record.action === 'rewrite'
      ? 'user-rewrite'
      : record.action === 're-add'
        ? 're-add'
        : record.source
    resolved.set(record.itemId, {
      latest: record,
      baseText,
      effectiveText,
      publicSource,
      lastRewrite,
    })
  }
  return resolved
}

export function summarizePlanOverrides(snapshot: CarryForwardSnapshot, records: PlanOverrideRecord[]): PlanOverrideItemState[] {
  return [...resolveOverrides(snapshot, records).entries()].map(([itemId, override]) => ({
    itemId,
    source: override.latest.source,
    originalText: override.baseText,
    effectiveText: override.effectiveText,
    latestAction: override.latest.action,
    included: override.effectiveText != null,
  }))
}

export function normalizePlanJudgments(
  snapshot: CarryForwardSnapshot,
  input?: ProposalPlanInput,
): PlanJudgmentRecord[] {
  const provided = new Map((input?.judgments ?? []).map((item) => [item.candidateId, item]))
  return snapshot.candidates.map((candidate) => {
    const value = provided.get(candidate.candidateId)
    const judgment = value?.judgment === 'carry' || value?.judgment === 'drop' || value?.judgment === 'uncertain'
      ? value.judgment
      : 'uncertain'
    const reason = typeof value?.reason === 'string' && value.reason.trim()
      ? value.reason.trim().slice(0, 280)
      : defaultJudgmentReason(judgment)
    return {
      candidateId: candidate.candidateId,
      judgment,
      reason,
      remainingAction: value?.remainingAction?.trim() ? cleanText(value.remainingAction).slice(0, 500) : null,
    }
  })
}

export function mergeProposalPlan(input: {
  content: string
  templateContent: string
  snapshot: CarryForwardSnapshot
  plan?: ProposalPlanInput
  overrides?: PlanOverrideRecord[]
  existingJudgments?: PlanJudgmentRecord[]
  baselineFinalContent?: string | null
}): { content: string; state: PlanState; proposalPlanParseFailure: string | null } {
  const judgments = input.existingJudgments?.length
    ? input.existingJudgments
    : normalizePlanJudgments(input.snapshot, input.plan)
  const forbidden = nextWeekPlanPolicy(input.templateContent) === 'forbidden'
  const parsed = parseNextWeekPlan(input.content)
  const judgmentByCandidate = new Map(judgments.map((item) => [item.candidateId, item]))
  const resolvedOverrides = resolveOverrides(input.snapshot, input.overrides ?? [])
  const blockedOverrideText = new Set<string>()
  for (const [itemId, override] of resolvedOverrides) {
    const candidate = input.snapshot.candidates.find((item) => item.candidateId === itemId)
    if (candidate) blockedOverrideText.add(candidate.normalizedText)
    if (override.baseText) blockedOverrideText.add(normalizeText(override.baseText))
    if (override.lastRewrite) blockedOverrideText.add(normalizeText(override.lastRewrite))
    if (override.effectiveText) blockedOverrideText.add(normalizeText(override.effectiveText))
  }
  // Once a drop tombstone is active, semantic matching cannot prove that an
  // identity-free provider item is unrelated. Exclude all such AI/Markdown/
  // baseline items until explicit re-add; session overrides remain available.
  const hasActiveDrop = [...resolvedOverrides.values()].some((override) => !override.effectiveText)
  const explicitItems = (input.plan?.items ?? [])
    .map((item) => ({ ...item, text: cleanText(item.text) }))
    .filter((item) => item.text.length > 0)
    .filter(() => !hasActiveDrop)
    .filter((item) => !item.candidateId || !resolvedOverrides.has(item.candidateId))
    .filter((item) => !blockedOverrideText.has(normalizeText(item.text)))
    .filter((item) => {
      if (item.source !== 'carry-forward') return true
      const candidate = item.candidateId ? judgmentByCandidate.get(item.candidateId) : undefined
      return candidate?.judgment === 'carry'
    })
  const blockedCarryText = new Set(input.snapshot.candidates
    .filter((candidate) => judgmentByCandidate.get(candidate.candidateId)?.judgment !== 'carry')
    .map((candidate) => candidate.normalizedText))
  const generatedItems = parsed.status === 'found' && !hasActiveDrop
    ? parsed.items
      .map((text) => ({ text: cleanText(text), source: 'current-fact' as const, candidateId: null }))
      .filter((item) => !blockedCarryText.has(normalizeText(item.text)))
      .filter((item) => !blockedOverrideText.has(normalizeText(item.text)))
    : []
  const overrideNewItems = [...resolvedOverrides.entries()].flatMap(([itemId, override]) => {
    if (override.latest.source !== 'this-week-new' || !override.effectiveText) return []
    return [{
      text: override.effectiveText,
      source: 'user-goal' as const,
      candidateId: null,
      itemId,
      publicSource: override.publicSource,
    }]
  })
  const carryItems = input.snapshot.candidates.flatMap((candidate) => {
    const override = resolvedOverrides.get(candidate.candidateId)
    if (override) {
      if (!override.effectiveText) return []
      return [{
        text: override.effectiveText,
        source: 'carry-forward' as const,
        candidateId: candidate.candidateId,
        itemId: candidate.candidateId,
        publicSource: override.publicSource,
      }]
    }
    const judgment = judgments.find((item) => item.candidateId === candidate.candidateId)
    if (!judgment || judgment.judgment !== 'carry') return []
    return [{
      text: judgment.remainingAction || candidate.text,
      source: 'carry-forward' as const,
      candidateId: candidate.candidateId,
      itemId: candidate.candidateId,
      publicSource: 'carry-forward' as const,
    }]
  })
  const baselineParsed = input.baselineFinalContent ? parseNextWeekPlan(input.baselineFinalContent) : null
  const baselineItems = baselineParsed?.status === 'found' && !hasActiveDrop
    ? baselineParsed.items
      .map((text) => ({ text: cleanText(text), source: 'baseline' as const, candidateId: null }))
      .filter((item) => !blockedOverrideText.has(normalizeText(item.text)))
    : []
  const priority: PlanSource[] = ['user-goal', 'carry-forward', 'current-fact', 'baseline']
  const all = [
    ...overrideNewItems,
    ...explicitItems.map((item) => ({
      ...item,
      candidateId: item.candidateId ?? null,
      itemId: item.candidateId ?? null,
      publicSource: item.source === 'carry-forward'
        ? 'carry-forward' as const
        : item.source === 'baseline'
          ? 'editing-baseline' as const
          : 'this-week-new' as const,
    })),
    ...carryItems,
    ...generatedItems.map((item) => ({ ...item, itemId: null, publicSource: 'this-week-new' as const })),
    ...baselineItems.map((item) => ({ ...item, itemId: null, publicSource: 'editing-baseline' as const })),
  ]
  const items: PlanState['items'] = []
  const seen = new Set<string>()
  for (const source of priority) {
    for (const item of all) {
      if (item.source !== source) continue
      const key = normalizeText(item.text)
      if (!key || seen.has(key)) continue
      seen.add(key)
      items.push({
        text: item.text,
        source: item.source,
        candidateId: item.candidateId ?? null,
        itemId: item.itemId,
        publicSource: item.publicSource,
      })
    }
  }
  const truncatedCount = Math.max(0, items.length - MAX_PLAN_ITEMS)
  const selected = items.slice(0, MAX_PLAN_ITEMS)
  const warnings = truncatedCount > 0 ? [`下周计划超过 ${MAX_PLAN_ITEMS} 项，已按固定优先级截断 ${truncatedCount} 项。`] : []
  if (hasActiveDrop) warnings.push('存在持续 drop 覆盖：未绑定会话事项身份的 AI、Markdown 与基线计划项已排除；只有显式 re-add 可解除。')
  if (parsed.status === 'failed') warnings.push(`下周计划章节无法解析：${parsed.reason}`)
  if (input.snapshot.parseWarning) warnings.push(input.snapshot.parseWarning)
  const overrideConclusions: PlanOverrideConclusion[] = [...resolvedOverrides.entries()].map(([itemId, override]) => ({
    itemId,
    action: override.latest.action,
    result: override.effectiveText == null ? 'excluded' : 'included',
    replacementText: override.latest.replacementText,
    source: override.latest.source,
  }))
  if (forbidden) {
    return {
      content: removePlanSection(input.content),
      state: { version: 1, status: 'forbidden', section: 'omitted', items: [], judgments, overrideConclusions, truncatedCount: 0, warnings: ['模板明确禁止下周计划章节。'] },
      proposalPlanParseFailure: parsed.status === 'failed' ? parsed.reason : null,
    }
  }
  const section = findPlanSection(input.content) ? 'present' : 'appended'
  return {
    content: replacePlanSection(input.content, selected.map((item) => item.text)),
    state: {
      version: 1,
      status: selected.length > 0 ? 'included' : 'empty',
      section,
      items: selected,
      judgments,
      overrideConclusions,
      truncatedCount,
      warnings,
    },
    proposalPlanParseFailure: parsed.status === 'failed' ? parsed.reason : null,
  }
}
