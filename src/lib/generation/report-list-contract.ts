import type { AudienceVariant } from '@/lib/db/schema'

export const REPORT_LIST_TOOL_NAME = 'query_report_list'
export const HISTORICAL_REFERENCE_LABEL = '历史参考·不可信'

export type ReportListRelation = 'overlap' | 'previous_adjacent'

export interface ReportListToolInput {
  query?: string
  title?: string
  startDate?: string
  endDate?: string
  statuses?: string[]
  includeLegacy?: boolean
  relation?: string
  relativeToReportId?: number
  cursor?: string
  limit?: number
}

export interface AppliedReportListFilters {
  query: string | null
  title: string | null
  startDate: string | null
  endDate: string | null
  statuses: Array<'current' | 'stale'>
  includeLegacy: boolean
  relation: ReportListRelation
  relativeToReportId: number | null
  cursor: string | null
  limit: number
}

export interface ReportListMatch {
  field: 'title' | 'content'
  content: string
  startLine?: number
  endLine?: number
}

export interface ReportListItem {
  reportId: number
  title: string
  weekStart: string
  weekEnd: string
  audience: AudienceVariant
  finalStatus: 'current' | 'stale'
  isLegacy: boolean
  updatedAt: string
  contentAvailable: true
  warning?: string
  matches?: ReportListMatch[]
}

export type ReportListToolResult = {
  ok: true
  items: ReportListItem[]
  nextCursor: string | null
  hasMore: boolean
  appliedFilters: AppliedReportListFilters
  matchesTruncated?: boolean
  referenceBoundary: { label: typeof HISTORICAL_REFERENCE_LABEL; statement: string }
} | {
  ok: false
  error: { code: 'INVALID_QUERY' | 'NOT_AVAILABLE' | 'QUERY_FAILED' | 'TOOL_BUDGET_EXCEEDED'; message: string }
  referenceBoundary: { label: typeof HISTORICAL_REFERENCE_LABEL; statement: string }
}

export const REFERENCE_BOUNDARY = {
  label: HISTORICAL_REFERENCE_LABEL,
  statement: '历史周报列表仅供参考，与当前周报原稿严格分离，不能替代或扩充本周事实。',
} as const

export function isReportListToolResult(value: unknown): value is ReportListToolResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return typeof result.ok === 'boolean'
    && Boolean(result.referenceBoundary)
    && (result.ok === false || (Array.isArray(result.items) && Boolean(result.appliedFilters)))
}
