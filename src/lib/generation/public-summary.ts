import type { AudienceVariant } from '@/lib/db/schema'
import type { CarryForwardSnapshot } from './carry-forward-snapshot'
import type { PlanJudgment, PlanState } from './plan'
import type { ReportListToolResult } from './report-list-contract'
import type { ReportContentToolResult } from './report-content-contract'
import { STRUCTURE_COMPLETENESS_RULE_VERSION } from '@/lib/reports/structure-completeness'

export { STRUCTURE_COMPLETENESS_RULE_VERSION }

export type PublicPlanItemSource =
  | 'carry-forward'
  | 'this-week-new'
  | 'user-rewrite'
  | 're-add'
  | 'editing-baseline'

export interface PublicGenerationSummaryInput {
  modelHandling?: string[]
}

export interface PublicGenerationSummary {
  version: 1
  modelHandling: string[]
  planJudgments: Array<{
    candidateId: string
    judgment: PlanJudgment
    reason: string
    remainingAction: string | 'none'
  }>
  planOverrideConclusions: Array<{
    itemId: string
    action: 'keep' | 'drop' | 'rewrite' | 're-add'
    result: string
    replacementText: string | 'none'
    source: 'carry-forward' | 'this-week-new'
  }>
  planItems: Array<{
    text: string
    source: PublicPlanItemSource
    candidateId: string | 'none'
    itemId: string | 'none'
  }>
  historicalReferences: Array<{
    kind: 'carry-forward' | 'report-query'
    reportId: number
    title: string
    audience: AudienceVariant
    weekStart: string
    weekEnd: string
    finalStatus: 'current' | 'stale'
    isLegacy?: boolean
    warning?: string
    acceptedProposalId: number | 'none'
    snapshotCapturedAt: string | 'none'
    sourceUpdatedAt: string
    trust: 'historical-reference-untrusted'
  }>
  toolStatuses: Array<{
    toolName: string
    status: 'succeeded' | 'failed' | 'truncated'
    detail: string | 'none'
  }>
  failureStates: Array<{
    scope: string
    code: string
    message: string
  }>
  truncationStates: Array<{
    scope: string
    omittedCount: number
    message: string
  }>
  changeSummary: string[]
  factBoundary: {
    currentWeekFacts: 'report-source-draft-only'
    historicalReferences: 'untrusted'
    hiddenReasoning: 'none'
    summaryAsFact: 'none'
    scoringInput: 'none'
    statement: string
  }
  templateSection: {
    policy: 'required' | 'forbidden'
    status: PlanState['section']
  }
  structureCompleteness: {
    ruleVersion: typeof STRUCTURE_COMPLETENESS_RULE_VERSION
    status: 'satisfied'
  }
}

type PublicHistoricalReference = PublicGenerationSummary['historicalReferences'][number]

function queriedHistoricalReference(item: {
  reportId: number
  title: string
  audience: AudienceVariant
  weekStart: string
  weekEnd: string
  finalStatus: 'current' | 'stale'
  isLegacy: boolean
  warning?: string
  updatedAt: string
}): PublicHistoricalReference {
  return {
    kind: 'report-query',
    reportId: item.reportId,
    title: item.title,
    audience: item.audience,
    weekStart: item.weekStart,
    weekEnd: item.weekEnd,
    finalStatus: item.finalStatus,
    isLegacy: item.isLegacy,
    warning: item.warning,
    acceptedProposalId: 'none',
    snapshotCapturedAt: 'none',
    sourceUpdatedAt: item.updatedAt,
    trust: 'historical-reference-untrusted',
  }
}

const FACT_BOUNDARY_STATEMENT = '当前受众版本的周报原稿是本周已发生工作事实的唯一权威来源；历史参考与公开生成摘要不是本周事实，也不作为评分输入。'

function normalizedAuditText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function historicalBodyText(snapshot: CarryForwardSnapshot): string[] {
  return [snapshot.planText, ...snapshot.candidates.map((candidate) => candidate.text)]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizedAuditText)
}

function cleanPublicProseList(input: {
  values: string[] | undefined
  limit: number
  maxLength: number
  historicalText: string[]
}): { values: string[]; truncatedCount: number } {
  const safeValues = (input.values ?? [])
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((item) => {
      const normalized = normalizedAuditText(item)
      return !input.historicalText.some((historical) => historical && normalized.includes(historical))
    })
  const shortenedValues = safeValues.map((value) => value.slice(0, input.maxLength))
  const shortenedCount = safeValues.filter((value) => value.length > input.maxLength).length
  const omittedCount = Math.max(0, shortenedValues.length - input.limit)
  return {
    values: shortenedValues.slice(0, input.limit),
    truncatedCount: shortenedCount + omittedCount,
  }
}

export function publicPlanSourceLabel(source: PublicPlanItemSource): string {
  if (source === 'this-week-new') return '本周新增'
  if (source === 'user-rewrite') return 'user rewrite'
  if (source === 'editing-baseline') return '编辑基线'
  return source
}

export function buildPublicGenerationSummary(input: {
  explicit?: PublicGenerationSummaryInput
  changeSummary: string[]
  planState: PlanState
  carryForwardSnapshot: CarryForwardSnapshot
  templatePolicy: 'required' | 'forbidden'
  proposalPlanParseFailure?: string | null
  historicalReportListResults?: ReportListToolResult[]
  historicalReportContentResults?: ReportContentToolResult[]
}): PublicGenerationSummary {
  const source = input.carryForwardSnapshot.source
  const historicalText = [
    ...historicalBodyText(input.carryForwardSnapshot),
    ...(input.historicalReportContentResults ?? []).flatMap((result) => result.ok && result.found
      ? [result.content, ...(result.matches ?? []).map((match) => match.content)]
        .filter((value): value is string => Boolean(value?.trim())).map(normalizedAuditText)
      : []),
  ]
  const modelHandling = cleanPublicProseList({
    values: input.explicit?.modelHandling,
    limit: 8,
    maxLength: 280,
    historicalText,
  })
  const queriedReferences = new Map<string, PublicHistoricalReference>()
  for (const result of input.historicalReportListResults ?? []) {
    if (!result.ok) continue
    for (const item of result.items) {
      queriedReferences.set(`${item.reportId}:${item.audience}`, queriedHistoricalReference(item))
    }
  }
  for (const result of input.historicalReportContentResults ?? []) {
    if (!result.ok || !result.found || result.identity.finalStatus === 'none') continue
    const item = result.identity
    queriedReferences.set(`${item.reportId}:${item.audience}`, queriedHistoricalReference({
      ...item,
      finalStatus: item.finalStatus === 'stale' ? 'stale' : 'current',
    }))
  }
  const referenceChanges = [...queriedReferences.values()].map((item) =>
    `历史参考：${item.title} · ${item.weekStart}–${item.weekEnd} · ${item.audience} · ${item.isLegacy ? 'legacy' : item.finalStatus} · ${item.warning ?? '历史参考·不可信'}`,
  )
  const changeSummary = cleanPublicProseList({
    values: [...referenceChanges, ...input.changeSummary],
    limit: 12,
    maxLength: 280,
    historicalText,
  })
  const failureStates: PublicGenerationSummary['failureStates'] = []
  const toolStatuses: PublicGenerationSummary['toolStatuses'] = []
  const historyTruncations: PublicGenerationSummary['truncationStates'] = []
  const recordHistoryTool = (toolName: string, result: ReportListToolResult | ReportContentToolResult) => {
    if (!result.ok) {
      toolStatuses.push({ toolName, status: 'failed', detail: result.error.code })
      failureStates.push({ scope: toolName, code: result.error.code, message: result.error.message })
      return
    }
    const truncated = ('truncated' in result && result.truncated === true) || ('matchesTruncated' in result && result.matchesTruncated === true)
    toolStatuses.push({ toolName, status: truncated ? 'truncated' : 'succeeded', detail: truncated ? 'bounded-output' : 'none' })
    if (truncated) historyTruncations.push({ scope: toolName, omittedCount: 1, message: '历史查询结果已达到字符或片段预算，后续节选被省略。' })
  }
  for (const result of input.historicalReportListResults ?? []) recordHistoryTool('query_report_list', result)
  for (const result of input.historicalReportContentResults ?? []) recordHistoryTool('query_report_content', result)
  if (input.carryForwardSnapshot.status === 'parse-failed') {
    failureStates.push({
      scope: 'carry-forward',
      code: 'CARRY_FORWARD_PARSE_FAILED',
      message: input.carryForwardSnapshot.parseReason ?? 'The carry-forward plan could not be parsed.',
    })
  }
  if (input.proposalPlanParseFailure) {
    failureStates.push({
      scope: 'proposal-next-week-plan',
      code: 'PROPOSAL_PLAN_PARSE_FAILED',
      message: input.proposalPlanParseFailure,
    })
  }
  const truncationStates: PublicGenerationSummary['truncationStates'] = [...historyTruncations]
  if (input.planState.truncatedCount > 0) {
    truncationStates.push({
      scope: 'next-week-plan',
      omittedCount: input.planState.truncatedCount,
      message: `下周计划按固定优先级截断 ${input.planState.truncatedCount} 项。`,
    })
  }
  if (modelHandling.truncatedCount > 0) {
    truncationStates.push({
      scope: 'model-handling',
      omittedCount: modelHandling.truncatedCount,
      message: `模型显式处理说明有 ${modelHandling.truncatedCount} 项被截短或省略。`,
    })
  }
  if (changeSummary.truncatedCount > 0) {
    truncationStates.push({
      scope: 'proposal-change-summary',
      omittedCount: changeSummary.truncatedCount,
      message: `提案变更摘要有 ${changeSummary.truncatedCount} 项被截短或省略。`,
    })
  }

  return {
    version: 1,
    modelHandling: modelHandling.values,
    planJudgments: input.planState.judgments.map((item) => ({
      candidateId: item.candidateId,
      judgment: item.judgment,
      reason: item.reason,
      remainingAction: item.remainingAction ?? 'none',
    })),
    planOverrideConclusions: input.planState.overrideConclusions.map((item) => ({
      itemId: item.itemId,
      action: item.action,
      result: item.result,
      replacementText: item.replacementText ?? 'none',
      source: item.source,
    })),
    planItems: input.planState.items.map((item) => ({
      text: item.text,
      source: item.publicSource,
      candidateId: item.candidateId ?? 'none',
      itemId: item.itemId ?? 'none',
    })),
    historicalReferences: [...(source ? [{
      kind: 'carry-forward',
      reportId: source.reportId,
      title: source.title,
      audience: source.audience,
      weekStart: source.weekStart,
      weekEnd: source.weekEnd,
      finalStatus: source.finalStatus,
      acceptedProposalId: source.acceptedProposalId ?? 'none',
      snapshotCapturedAt: input.carryForwardSnapshot.capturedAt ?? 'none',
      sourceUpdatedAt: source.updatedAt,
      trust: 'historical-reference-untrusted',
    } satisfies PublicGenerationSummary['historicalReferences'][number]] : []), ...queriedReferences.values()],
    toolStatuses: [...toolStatuses, { toolName: 'propose_final_report', status: 'succeeded', detail: 'proposal-created' }],
    failureStates,
    truncationStates,
    changeSummary: changeSummary.values,
    factBoundary: {
      currentWeekFacts: 'report-source-draft-only',
      historicalReferences: 'untrusted',
      hiddenReasoning: 'none',
      summaryAsFact: 'none',
      scoringInput: 'none',
      statement: FACT_BOUNDARY_STATEMENT,
    },
    templateSection: { policy: input.templatePolicy, status: input.planState.section },
    structureCompleteness: { ruleVersion: STRUCTURE_COMPLETENESS_RULE_VERSION, status: 'satisfied' },
  }
}

export function normalizePublicGenerationSummary(value: unknown): PublicGenerationSummary | null {
  if (!value || typeof value !== 'object') return null
  const summary = value as Partial<PublicGenerationSummary>
  if (summary.version !== 1
    || !Array.isArray(summary.modelHandling)
    || !Array.isArray(summary.planJudgments)
    || !Array.isArray(summary.planOverrideConclusions)
    || !Array.isArray(summary.planItems)
    || !Array.isArray(summary.historicalReferences)
    || !Array.isArray(summary.toolStatuses)
    || !Array.isArray(summary.failureStates)
    || !Array.isArray(summary.truncationStates)
    || !Array.isArray(summary.changeSummary)
    || !summary.factBoundary
    || !summary.templateSection
    || !summary.structureCompleteness) return null
  return summary as PublicGenerationSummary
}
