import { parseNextWeekPlan } from '@/lib/reports/next-week-plan'
import type { CarryForwardSnapshot } from './carry-forward-snapshot'

export type PlanJudgment = 'carry' | 'drop' | 'uncertain'
export type PlanSource = 'user-goal' | 'carry-forward' | 'current-fact' | 'baseline'

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
  items: Array<{ text: string; source: PlanSource; candidateId: string | null }>
  judgments: PlanJudgmentRecord[]
  truncatedCount: number
  warnings: string[]
}

export function parsePlanState(value: unknown): PlanState | null {
  if (!value || typeof value !== 'object') return null
  const state = value as Partial<PlanState>
  if (state.version !== 1 || !['included', 'empty', 'forbidden'].includes(String(state.status))) return null
  if (!Array.isArray(state.items) || !Array.isArray(state.judgments)) return null
  return value as PlanState
}

const MAX_PLAN_ITEMS = 5
const PLAN_TITLE = '下周计划'
const HEADING = /^( {0,3})(#{2,3})(?:[ \t]+|$)(.*?)[ \t]*#*[ \t]*$/

function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function cleanText(value: string): string {
  return value.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').replace(/\s+/g, ' ').trim()
}

function templateForbidsPlan(template: string): boolean {
  const normalized = template.normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase()
  return /(?:禁止|不要|不包含|无需|省略|omit|without|exclude|no)\s*(?:编写|输出|包含|添加|include|write)?\s*(?:“|「|the\s+)?(?:下周计划|下周重点|next\s*week\s*plan)/i.test(normalized)
    || /(?:下周计划|next\s*week\s*plan)[^。.!\n]{0,30}(?:禁止|不要|不包含|omit|without|exclude|no)/i.test(normalized)
}

export function getPlanTemplatePolicy(template: string): 'forbidden' | 'required' {
  return templateForbidsPlan(template) ? 'forbidden' : 'required'
}

function hasPlanHeading(content: string): boolean {
  return content.split(/\r?\n/).some((line) => {
    const match = line.match(HEADING)
    return Boolean(match && match[3].trim().toLocaleLowerCase() === PLAN_TITLE.toLocaleLowerCase())
  })
}

function replacePlanSection(content: string, items: string[]): string {
  const lines = content.split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => {
    const match = line.match(HEADING)
    return Boolean(match && match[3].trim().toLocaleLowerCase() === PLAN_TITLE.toLocaleLowerCase())
  })
  const body = items.length > 0 ? items.map((item) => `- ${item}`) : ['（暂无可用的下周计划事项）']
  if (headingIndex < 0) {
    const prefix = content.trimEnd()
    return `${prefix}${prefix ? '\n\n' : ''}## ${PLAN_TITLE}\n${body.join('\n')}`
  }
  const heading = lines[headingIndex]
  const headingLevel = heading.match(HEADING)?.[2].length ?? 2
  let end = headingIndex + 1
  while (end < lines.length) {
    const match = lines[end].match(HEADING)
    if (match && match[2].length <= headingLevel) break
    end += 1
  }
  lines.splice(headingIndex, end - headingIndex, heading, ...body)
  return lines.join('\n').trimEnd()
}

function removePlanSection(content: string): string {
  const lines = content.split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => {
    const match = line.match(HEADING)
    return Boolean(match && match[3].trim().toLocaleLowerCase() === PLAN_TITLE.toLocaleLowerCase())
  })
  if (headingIndex < 0) return content.trimEnd()
  const headingLevel = lines[headingIndex].match(HEADING)?.[2].length ?? 2
  let end = headingIndex + 1
  while (end < lines.length) {
    const match = lines[end].match(HEADING)
    if (match && match[2].length <= headingLevel) break
    end += 1
  }
  const before = lines.slice(0, headingIndex)
  const after = lines.slice(end)
  return [...before, ...after].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

function defaultJudgmentReason(judgment: PlanJudgment): string {
  if (judgment === 'carry') return '保留上一周期尚未完成的计划事项。'
  if (judgment === 'drop') return '上一周期事项已完成或不再适用。'
  return '本轮未可靠判断，默认不自动结转。'
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
  existingJudgments?: PlanJudgmentRecord[]
  baselineFinalContent?: string | null
}): { content: string; state: PlanState } {
  const judgments = input.existingJudgments?.length
    ? input.existingJudgments
    : normalizePlanJudgments(input.snapshot, input.plan)
  const forbidden = templateForbidsPlan(input.templateContent)
  const parsed = parseNextWeekPlan(input.content)
  const judgmentByCandidate = new Map(judgments.map((item) => [item.candidateId, item]))
  const explicitItems = (input.plan?.items ?? [])
    .map((item) => ({ ...item, text: cleanText(item.text) }))
    .filter((item) => item.text.length > 0)
    .filter((item) => {
      if (item.source !== 'carry-forward') return true
      const candidate = item.candidateId ? judgmentByCandidate.get(item.candidateId) : undefined
      return candidate?.judgment === 'carry'
    })
  const blockedCarryText = new Set(input.snapshot.candidates
    .filter((candidate) => judgmentByCandidate.get(candidate.candidateId)?.judgment !== 'carry')
    .map((candidate) => candidate.normalizedText))
  const generatedItems = parsed.status === 'found'
    ? parsed.items
      .map((text) => ({ text: cleanText(text), source: 'current-fact' as const, candidateId: null }))
      .filter((item) => !blockedCarryText.has(normalizeText(item.text)))
    : []
  const carryItems = input.snapshot.candidates.flatMap((candidate) => {
    const judgment = judgments.find((item) => item.candidateId === candidate.candidateId)
    if (!judgment || judgment.judgment !== 'carry') return []
    return [{
      text: judgment.remainingAction || candidate.text,
      source: 'carry-forward' as const,
      candidateId: candidate.candidateId,
    }]
  })
  const baselineParsed = input.baselineFinalContent ? parseNextWeekPlan(input.baselineFinalContent) : null
  const baselineItems = baselineParsed?.status === 'found'
    ? baselineParsed.items.map((text) => ({ text: cleanText(text), source: 'baseline' as const, candidateId: null }))
    : []
  const priority: PlanSource[] = ['user-goal', 'carry-forward', 'current-fact', 'baseline']
  const all = [...explicitItems.map((item) => ({ ...item, candidateId: item.candidateId ?? null })), ...carryItems, ...generatedItems, ...baselineItems]
  const items: PlanState['items'] = []
  const seen = new Set<string>()
  for (const source of priority) {
    for (const item of all) {
      if (item.source !== source) continue
      const key = normalizeText(item.text)
      if (!key || seen.has(key)) continue
      seen.add(key)
      items.push({ text: item.text, source: item.source, candidateId: item.candidateId ?? null })
    }
  }
  const truncatedCount = Math.max(0, items.length - MAX_PLAN_ITEMS)
  const selected = items.slice(0, MAX_PLAN_ITEMS)
  const warnings = truncatedCount > 0 ? [`下周计划超过 ${MAX_PLAN_ITEMS} 项，已按固定优先级截断 ${truncatedCount} 项。`] : []
  if (parsed.status === 'failed') warnings.push(`下周计划章节无法解析：${parsed.reason}`)
  if (input.snapshot.parseWarning) warnings.push(input.snapshot.parseWarning)
  if (forbidden) {
    return {
      content: removePlanSection(input.content),
      state: { version: 1, status: 'forbidden', section: 'omitted', items: [], judgments, truncatedCount: 0, warnings: ['模板明确禁止下周计划章节。'] },
    }
  }
  const section = hasPlanHeading(input.content) ? 'present' : 'appended'
  return {
    content: replacePlanSection(input.content, selected.map((item) => item.text)),
    state: {
      version: 1,
      status: selected.length > 0 ? 'included' : 'empty',
      section,
      items: selected,
      judgments,
      truncatedCount,
      warnings,
    },
  }
}
