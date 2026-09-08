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
  statuses: ['current']
  includeLegacy: false
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
  finalStatus: 'current'
  isLegacy: false
  updatedAt: string
  contentAvailable: true
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
  error: { code: 'INVALID_QUERY' | 'QUERY_FAILED'; message: string }
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

export function buildHistoricalReportListContext(results: ReportListToolResult[]): string {
  if (results.length === 0) {
    return `${HISTORICAL_REFERENCE_LABEL}（历史周报列表查询尚未产生；不得从其他来源补位）`
  }
  return `历史周报列表查询结果区块（${HISTORICAL_REFERENCE_LABEL}，与当前周报原稿严格分离）：
${results.map((result, index) => {
    if (!result.ok) return `${index + 1}. 查询失败 · ${result.error.code}: ${result.error.message}`
    const sources = result.items.length > 0
      ? result.items.map((item) => {
          const matches = item.matches?.length
            ? `\n${item.matches.map((match) => `  - ${match.field}${match.startLine ? ` lines ${match.startLine}–${match.endLine}` : ''}:\n    ---\n    ${match.content.replaceAll('\n', '\n    ')}\n    ---`).join('\n')}`
            : ''
          return `- ${item.title} (#${item.reportId}) · ${item.weekStart}–${item.weekEnd} · ${item.audience} · ${item.finalStatus}${matches}`
        }).join('\n')
      : '- 无结果；不得自动回退到其他周期、状态或受众。'
    return `${index + 1}. appliedFilters=${JSON.stringify(result.appliedFilters)}\n${sources}`
  }).join('\n')}
这些结果只能帮助定位历史参考，不能替代、扩充或纠正本周周报原稿中的事实。`
}
