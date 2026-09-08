import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { format, isValid, parseISO, subDays } from 'date-fns'
import { getDb } from '@/lib/db'
import { generationSessions, reportVariants, reports, type AudienceVariant } from '@/lib/db/schema'
import {
  REFERENCE_BOUNDARY,
  REPORT_LIST_TOOL_NAME,
  buildHistoricalReportListContext,
  isReportListToolResult,
  type AppliedReportListFilters,
  type ReportListItem,
  type ReportListMatch,
  type ReportListToolInput,
  type ReportListToolResult,
} from './report-list-contract'

export { buildHistoricalReportListContext, isReportListToolResult, REPORT_LIST_TOOL_NAME }
export type { ReportListToolInput, ReportListToolResult }

interface CursorValue {
  version: 1
  weekEnd: string
  reportId: number
}

interface AuthorizedReportRow {
  reportId: number
  title: string
  weekStart: string
  weekEnd: string
  audience: AudienceVariant
  finalStatus: 'current'
  finalContent: string
  updatedAt: Date
}

function invalid(message: string): ReportListToolResult {
  return { ok: false, error: { code: 'INVALID_QUERY', message }, referenceBoundary: REFERENCE_BOUNDARY }
}

function cleanTextFilter(value: string | undefined, field: 'query' | 'title'): string | null | ReportListToolResult {
  if (value === undefined) return null
  const normalized = value.trim()
  if (normalized.length < 1 || normalized.length > 200) {
    return invalid(`${field} must contain 1 to 200 characters after trimming`)
  }
  return normalized
}

function cleanDate(value: string | undefined, field: 'startDate' | 'endDate'): string | null | ReportListToolResult {
  if (value === undefined) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid(`${field} must use YYYY-MM-DD`)
  const parsed = parseISO(value)
  if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== value) return invalid(`${field} must be a valid date`)
  return value
}

function parseCursor(value: string): CursorValue | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CursorValue>
    if (parsed.version !== 1 || !Number.isInteger(parsed.reportId) || Number(parsed.reportId) <= 0) return null
    if (typeof parsed.weekEnd !== 'string' || cleanDate(parsed.weekEnd, 'endDate') !== parsed.weekEnd) return null
    return parsed as CursorValue
  } catch {
    return null
  }
}

function encodeCursor(row: Pick<AuthorizedReportRow, 'weekEnd' | 'reportId'>): string {
  return Buffer.from(JSON.stringify({ version: 1, weekEnd: row.weekEnd, reportId: row.reportId } satisfies CursorValue)).toString('base64url')
}

function normalizeFilters(
  input: ReportListToolInput,
  sessionReportId: number,
): AppliedReportListFilters | ReportListToolResult {
  const relation = input.relation ?? 'overlap'
  if (relation !== 'overlap' && relation !== 'previous_adjacent') {
    return invalid('relation must be overlap or previous_adjacent')
  }

  const title = cleanTextFilter(input.title, 'title')
  if (title && typeof title === 'object') return title
  const statuses = input.statuses ?? ['current']
  if (statuses.length === 0 || statuses.some((status) => status !== 'current' && status !== 'stale')) {
    return invalid('statuses must contain current or stale')
  }
  if (statuses.includes('stale')) {
    return invalid('stale report authorization is not available for this tool version')
  }
  if (input.includeLegacy === true) {
    return invalid('legacy report authorization is not available for this tool version')
  }

  if (relation === 'previous_adjacent') {
    if (!Number.isInteger(input.relativeToReportId) || input.relativeToReportId !== sessionReportId) {
      return invalid('previous_adjacent requires relativeToReportId to be the current session report')
    }
    return {
      query: null,
      title,
      startDate: null,
      endDate: null,
      statuses: ['current'],
      includeLegacy: false,
      relation,
      relativeToReportId: sessionReportId,
      cursor: null,
      limit: 1,
    }
  }

  const query = cleanTextFilter(input.query, 'query')
  if (query && typeof query === 'object') return query
  const startDate = cleanDate(input.startDate, 'startDate')
  if (startDate && typeof startDate === 'object') return startDate
  const endDate = cleanDate(input.endDate, 'endDate')
  if (endDate && typeof endDate === 'object') return endDate
  if (startDate && endDate && startDate > endDate) return invalid('startDate must not be after endDate')

  const limit = input.limit ?? 10
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) return invalid('limit must be an integer from 1 to 20')
  if (input.cursor !== undefined && !parseCursor(input.cursor)) return invalid('cursor is invalid')

  return {
    query,
    title,
    startDate,
    endDate,
    statuses: ['current'],
    includeLegacy: false,
    relation,
    relativeToReportId: null,
    cursor: input.cursor ?? null,
    limit,
  }
}

function containsLiteral(value: string, search: string): boolean {
  return value.toLowerCase().includes(search.toLowerCase())
}

function contentMatches(content: string, query: string): ReportListMatch[] {
  const lines = content.split('\n')
  const matchingLines = lines.flatMap((line, index) => containsLiteral(line, query) ? [index] : [])
  const ranges: Array<{ start: number; end: number }> = []
  for (const line of matchingLines) {
    const next = { start: Math.max(0, line - 1), end: Math.min(lines.length - 1, line + 1) }
    const previous = ranges.at(-1)
    if (previous && next.start <= previous.end + 1) previous.end = Math.max(previous.end, next.end)
    else ranges.push(next)
  }
  return ranges.slice(0, 3).map((range) => ({
    field: 'content' as const,
    startLine: range.start + 1,
    endLine: range.end + 1,
    content: lines.slice(range.start, range.end + 1).join('\n'),
  }))
}

function afterCursor(row: AuthorizedReportRow, cursor: CursorValue | null): boolean {
  if (!cursor) return true
  return row.weekEnd < cursor.weekEnd || (row.weekEnd === cursor.weekEnd && row.reportId < cursor.reportId)
}

function baseItem(row: AuthorizedReportRow): ReportListItem {
  return {
    reportId: row.reportId,
    title: row.title,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    audience: row.audience,
    finalStatus: row.finalStatus,
    isLegacy: false,
    updatedAt: row.updatedAt.toISOString(),
    contentAvailable: true,
  }
}

function attachMatches(rows: AuthorizedReportRow[], query: string): { items: ReportListItem[]; truncated: boolean } {
  let remainingCharacters = 20_000
  let truncated = false
  const items = rows.map((row) => {
    const matches: ReportListMatch[] = []
    const available = [
      ...(containsLiteral(row.title, query) ? [{ field: 'title' as const, content: row.title }] : []),
      ...contentMatches(row.finalContent, query),
    ]
    for (const match of available) {
      if (match.content.length > remainingCharacters) {
        truncated = true
        break
      }
      matches.push(match)
      remainingCharacters -= match.content.length
    }
    if (truncated) remainingCharacters = 0
    return { ...baseItem(row), matches }
  })
  return { items, truncated }
}

/** Executes a report-list query using only the audience persisted on the generation session. */
export function queryReportListForSession(input: {
  sessionId: number
  parameters: ReportListToolInput
}): ReportListToolResult {
  try {
    const db = getDb()
    const session = db.select({ reportId: generationSessions.reportId, audience: generationSessions.variant })
      .from(generationSessions).where(eq(generationSessions.id, input.sessionId)).get()
    if (!session) {
      return { ok: false, error: { code: 'QUERY_FAILED', message: 'Generation session is unavailable' }, referenceBoundary: REFERENCE_BOUNDARY }
    }
    const relativeReport = db.select({ weekStart: reports.weekStart }).from(reports)
      .where(eq(reports.id, session.reportId)).get()
    if (!relativeReport) {
      return { ok: false, error: { code: 'QUERY_FAILED', message: 'Current session report is unavailable' }, referenceBoundary: REFERENCE_BOUNDARY }
    }
    const filters = normalizeFilters(input.parameters, session.reportId)
    if ('ok' in filters) return filters

    const authorized = db.select({
      reportId: reports.id,
      title: reports.title,
      weekStart: reports.weekStart,
      weekEnd: reports.weekEnd,
      audience: reportVariants.variant,
      finalStatus: reportVariants.finalStatus,
      finalContent: reportVariants.finalContent,
      updatedAt: reportVariants.updatedAt,
    }).from(reportVariants).innerJoin(reports, eq(reportVariants.reportId, reports.id)).where(and(
      eq(reportVariants.variant, session.audience),
      eq(reportVariants.finalStatus, 'current'),
      isNotNull(reportVariants.finalContent),
    )).orderBy(desc(reports.weekEnd), desc(reports.id)).all() as AuthorizedReportRow[]

    const expectedPreviousEnd = format(subDays(parseISO(relativeReport.weekStart), 1), 'yyyy-MM-dd')
    const cursor = filters.cursor ? parseCursor(filters.cursor) : null
    const matchingRows = authorized.filter((row) => {
      if (filters.relation === 'previous_adjacent' && row.weekEnd !== expectedPreviousEnd) return false
      if (filters.relation === 'overlap') {
        if (filters.startDate && row.weekEnd < filters.startDate) return false
        if (filters.endDate && row.weekStart > filters.endDate) return false
        if (!afterCursor(row, cursor)) return false
      }
      if (filters.title && !containsLiteral(row.title, filters.title)) return false
      if (filters.query && !containsLiteral(row.title, filters.query) && !containsLiteral(row.finalContent, filters.query)) return false
      return true
    })

    const hasMore = filters.relation === 'overlap' && matchingRows.length > filters.limit
    const pageRows = matchingRows.slice(0, filters.limit)
    const matched = filters.query ? attachMatches(pageRows, filters.query) : null
    return {
      ok: true,
      items: matched?.items ?? pageRows.map(baseItem),
      nextCursor: hasMore && pageRows.length > 0 ? encodeCursor(pageRows.at(-1)!) : null,
      hasMore,
      appliedFilters: filters,
      ...(filters.query ? { matchesTruncated: matched?.truncated ?? false } : {}),
      referenceBoundary: REFERENCE_BOUNDARY,
    }
  } catch (error) {
    console.error('[generation] Report list query failed:', error)
    return { ok: false, error: { code: 'QUERY_FAILED', message: 'Failed to query historical reports' }, referenceBoundary: REFERENCE_BOUNDARY }
  }
}
