import type { AudienceVariant, FinalStatus } from '@/lib/db/schema'

export const REPORT_CONTENT_TOOL_NAME = 'query_report_content'
export const CONTENT_REFERENCE_BOUNDARY = {
  label: '历史参考·不可信',
  statement: '历史周报正文仅供参考，与当前周报原稿严格分离，不能替代或扩充本周事实。',
} as const

export interface ReportContentToolInput {
  reportId?: number
  query?: string
  maxMatches?: number
  contextLines?: number
  allowStale?: boolean
  allowLegacy?: boolean
}

export interface ReportContentMatch { startLine: number; endLine: number; content: string }
export interface ReportContentIdentity {
  reportId: number
  title: string
  weekStart: string
  weekEnd: string
  audience: AudienceVariant
  finalStatus: FinalStatus
  isLegacy: boolean
  updatedAt: string
  historicalReference: typeof CONTENT_REFERENCE_BOUNDARY.label
}

export type ReportContentToolResult = {
  ok: true
  found: true
  identity: ReportContentIdentity
  content?: string
  query?: string
  totalChars?: number
  returnedChars?: number
  truncated: boolean
  totalMatches?: number
  returnedMatches?: number
  matches?: ReportContentMatch[]
  referenceBoundary: typeof CONTENT_REFERENCE_BOUNDARY
} | {
  ok: true
  found: false
  reportId: number
  truncated: false
  referenceBoundary: typeof CONTENT_REFERENCE_BOUNDARY
} | {
  ok: false
  error: { code: 'INVALID_QUERY' | 'NOT_AVAILABLE' | 'QUERY_FAILED'; message: string }
  referenceBoundary: typeof CONTENT_REFERENCE_BOUNDARY
}

export function isReportContentToolResult(value: unknown): value is ReportContentToolResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return typeof result.ok === 'boolean' && Boolean(result.referenceBoundary)
}
