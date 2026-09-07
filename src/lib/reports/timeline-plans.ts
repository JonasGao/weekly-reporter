import { and, desc, eq, inArray } from 'drizzle-orm'
import { format, startOfWeek, subDays } from 'date-fns'
import { getDb } from '@/lib/db'
import { reportVariants, reports, type AudienceVariant } from '@/lib/db/schema'
import { parseNextWeekPlan, type TimelinePlanProjection } from './next-week-plan'

export interface TimelinePlanResponse {
  currentWeekStart: string
  previousCycle: { weekStart: string; weekEnd: string }
  plans: Record<AudienceVariant, TimelinePlanProjection>
}

function emptyProjection(
  audience: AudienceVariant,
  status: TimelinePlanProjection['status'],
  reason: string,
  source?: TimelinePlanProjection['source'],
): TimelinePlanProjection {
  return { audience, status, items: [], reason, ...(source ? { source } : {}) }
}

/**
 * Read-only projection of the exact previous cycle's adopted current finals.
 * This function only reads reports/variants and never changes report state.
 */
export async function getTimelinePlanProjection(now = new Date()): Promise<TimelinePlanResponse> {
  const currentWeekStartDate = startOfWeek(now, { weekStartsOn: 1 })
  const previousWeekEndDate = subDays(currentWeekStartDate, 1)
  const previousWeekStartDate = subDays(currentWeekStartDate, 7)
  const currentWeekStart = format(currentWeekStartDate, 'yyyy-MM-dd')
  const previousCycle = {
    weekStart: format(previousWeekStartDate, 'yyyy-MM-dd'),
    weekEnd: format(previousWeekEndDate, 'yyyy-MM-dd'),
  }
  const audiences: AudienceVariant[] = ['leadership', 'personal']
  const db = getDb()

  const candidateReports = await db.select().from(reports)
    .where(and(eq(reports.weekStart, previousCycle.weekStart), eq(reports.weekEnd, previousCycle.weekEnd)))
    .orderBy(desc(reports.updatedAt), desc(reports.id))

  const plans = {} as Record<AudienceVariant, TimelinePlanProjection>
  const candidateVariants = candidateReports.length > 0
    ? await db.select().from(reportVariants)
      .where(inArray(reportVariants.reportId, candidateReports.map((report) => report.id)))
    : []
  const variantsByAudience: Record<AudienceVariant, typeof candidateVariants> = {
    leadership: candidateVariants.filter((variant) => variant.variant === 'leadership'),
    personal: candidateVariants.filter((variant) => variant.variant === 'personal'),
  }

  for (const audience of audiences) {
    let source: typeof reports.$inferSelect | undefined
    let variant: typeof reportVariants.$inferSelect | undefined
    const audienceVariants = variantsByAudience[audience]
    for (const report of candidateReports) {
      const row = audienceVariants.find((candidate) => candidate.reportId === report.id)
      if (row?.finalStatus === 'current' && typeof row.finalContent === 'string' && row.finalContent.trim()) {
        source = report
        variant = row
        break
      }
    }

    if (!source || !variant) {
      plans[audience] = emptyProjection(
        audience,
        'no-source',
        'No exact previous-cycle current final report is available for this audience.',
      )
      continue
    }

    const sourceMetadata: TimelinePlanProjection['source'] = {
      reportId: source.id,
      title: source.title,
      weekStart: source.weekStart,
      weekEnd: source.weekEnd,
      audience,
      finalStatus: 'current',
    }
    const parsed = parseNextWeekPlan(variant.finalContent ?? '')
    if (parsed.status === 'found') {
      plans[audience] = {
        audience,
        status: 'found',
        items: parsed.items,
        source: sourceMetadata,
        ...(parsed.warning ? { warning: parsed.warning } : {}),
      }
    } else if (parsed.status === 'failed') {
      plans[audience] = emptyProjection(audience, 'parse-failed', parsed.reason, sourceMetadata)
    } else {
      plans[audience] = emptyProjection(audience, 'no-plan', parsed.reason, sourceMetadata)
    }
  }

  return { currentWeekStart, previousCycle, plans }
}
