import { and, between, eq } from 'drizzle-orm'
import { endOfDay, parseISO, startOfDay } from 'date-fns'
import { getDb } from '@/lib/db'
import {
  OFFICIAL_TEMPLATES,
} from '@/lib/official-templates'
import {
  rawEvents,
  reportEventSnapshots,
  reportVariants,
  reports,
  templates,
  type AudienceVariant,
  type ProjectScope,
  type RawEvent,
  type ReportEventSnapshot,
  type ReportVariant,
} from '@/lib/db/schema'
import { getSourceScopes } from '@/lib/collect/source-scopes'
import { buildSourceDraft, classifyEventForVariants } from './source-draft'

export const AUDIENCE_VARIANTS: AudienceVariant[] = ['leadership', 'personal']

function parseWeekBoundary(value: string, end: boolean): Date {
  const parsed = parseISO(value)
  return end ? endOfDay(parsed) : startOfDay(parsed)
}

export interface TemplateSelection {
  id: string
  name: string
  content: string
  aiStyle: string
}

export async function getTemplateSelection(templateId: string): Promise<TemplateSelection | null> {
  if (templateId.startsWith('official-')) {
    const template = OFFICIAL_TEMPLATES.find((item) => item.id === templateId)
    if (!template) return null
    return {
      id: template.id,
      name: template.name,
      content: template.content,
      aiStyle: template.aiStyle ?? 'formal',
    }
  }

  if (!templateId.startsWith('user-')) return null
  const numericId = Number.parseInt(templateId.slice('user-'.length), 10)
  if (Number.isNaN(numericId)) return null

  const db = getDb()
  const row = await db.query.templates.findFirst({ where: eq(templates.id, numericId) })
  if (!row) return null

  return {
    id: templateId,
    name: row.name,
    content: row.content,
    aiStyle: row.aiStyle ?? 'formal',
  }
}

async function findEventsForWeek(weekStart: string, weekEnd: string) {
  const db = getDb()
  return db.select().from(rawEvents).where(
    between(
      rawEvents.eventTime,
      parseWeekBoundary(weekStart, false),
      parseWeekBoundary(weekEnd, true),
    ),
  )
}

function variantSourceDrafts(events: RawEvent[], sourceScopes: ReadonlyMap<number, ProjectScope>) {
  return {
    leadership: buildSourceDraft(events, 'leadership', sourceScopes),
    personal: buildSourceDraft(events, 'personal', sourceScopes),
  } satisfies Record<AudienceVariant, string>
}

async function collectSourceDrafts(weekStart: string, weekEnd: string) {
  const [events, sourceScopes] = await Promise.all([
    findEventsForWeek(weekStart, weekEnd),
    getSourceScopes(),
  ])
  return {
    events,
    sourceScopes,
    drafts: variantSourceDrafts(events, sourceScopes),
  }
}

export async function previewReportSourceDrafts(input: {
  weekStart: string
  weekEnd: string
}) {
  const { drafts } = await collectSourceDrafts(input.weekStart, input.weekEnd)
  return AUDIENCE_VARIANTS.map((variant) => ({
    variant,
    sourceDraft: drafts[variant],
  }))
}

export async function createReportWithSourceDrafts(input: {
  title: string
  weekStart: string
  weekEnd: string
}) {
  const db = getDb()
  const { events, sourceScopes, drafts } = await collectSourceDrafts(input.weekStart, input.weekEnd)
  const now = new Date()

  const created = db.transaction((tx) => {
    const report = tx.insert(reports).values({
      title: input.title,
      // Kept populated for old list/search clients. New code reads variants.
      content: drafts.personal,
      scoreStatus: 'completed',
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
      createdAt: now,
      updatedAt: now,
    }).returning().get()

    if (events.length > 0) {
      tx.insert(reportEventSnapshots).values(events.map((event) => {
        const classification = classifyEventForVariants(event, sourceScopes)
        return {
          reportId: report.id,
          rawEventId: event.id,
          eventTime: event.eventTime,
          source: event.source,
          content: event.content,
          metadata: event.metadata,
          projectScope: classification.projectScope,
          leadershipIncluded: classification.leadershipIncluded,
          personalIncluded: classification.personalIncluded,
          sourceRevision: 1,
          createdAt: now,
        }
      })).run()
    }

    const variants = tx.insert(reportVariants).values(AUDIENCE_VARIANTS.map((variant) => ({
      reportId: report.id,
      variant,
      sourceDraft: drafts[variant],
      finalStatus: 'none' as const,
      sourceRevision: 1,
      scoreStatus: 'pending' as const,
      createdAt: now,
      updatedAt: now,
    }))).returning().all()

    return { report, variants }
  })

  return {
    report: created.report,
    variants: created.variants,
    snapshots: await getDb().select().from(reportEventSnapshots).where(
      and(eq(reportEventSnapshots.reportId, created.report.id), eq(reportEventSnapshots.sourceRevision, 1)),
    ),
  }
}

export async function getReportBundle(reportId: number) {
  const db = getDb()
  const report = await db.query.reports.findFirst({ where: eq(reports.id, reportId) })
  if (!report) return null

  const variants = await db.select().from(reportVariants).where(eq(reportVariants.reportId, reportId))
  const currentRevision = Math.max(0, ...variants.map((variant) => variant.sourceRevision))
  const snapshots = await db.select().from(reportEventSnapshots).where(
    and(eq(reportEventSnapshots.reportId, reportId), eq(reportEventSnapshots.sourceRevision, currentRevision)),
  )
  return { ...report, variants, snapshots }
}

export async function regenerateSourceDrafts(reportId: number) {
  const db = getDb()
  const report = await db.query.reports.findFirst({ where: eq(reports.id, reportId) })
  if (!report) return null

  const [events, sourceScopes] = await Promise.all([
    findEventsForWeek(report.weekStart, report.weekEnd),
    getSourceScopes(),
  ])
  const drafts = variantSourceDrafts(events, sourceScopes)
  const now = new Date()

  db.transaction((tx) => {
    const currentVariants = tx.select().from(reportVariants).where(eq(reportVariants.reportId, reportId)).all()
    const nextRevision = Math.max(0, ...currentVariants.map((variant) => variant.sourceRevision)) + 1

    if (events.length > 0) {
      tx.insert(reportEventSnapshots).values(events.map((event) => {
        const classification = classifyEventForVariants(event, sourceScopes)
        return {
          reportId,
          rawEventId: event.id,
          eventTime: event.eventTime,
          source: event.source,
          content: event.content,
          metadata: event.metadata,
          projectScope: classification.projectScope,
          leadershipIncluded: classification.leadershipIncluded,
          personalIncluded: classification.personalIncluded,
          sourceRevision: nextRevision,
          createdAt: now,
        }
      })).run()
    }

    for (const variant of AUDIENCE_VARIANTS) {
      const existing = currentVariants.find((item) => item.variant === variant)
      if (existing) {
        tx.update(reportVariants).set({
          sourceDraft: drafts[variant],
          sourceRevision: nextRevision,
          finalStatus: existing.finalContent ? 'stale' : 'none',
          updatedAt: now,
        }).where(eq(reportVariants.id, existing.id)).run()
      } else {
        tx.insert(reportVariants).values({
          reportId,
          variant,
          sourceDraft: drafts[variant],
          sourceRevision: nextRevision,
          finalStatus: 'none',
          scoreStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        }).run()
      }
    }

    tx.update(reports).set({
      content: drafts.personal,
      updatedAt: now,
    }).where(eq(reports.id, reportId)).run()
  })

  return getReportBundle(reportId)
}

export async function getReportVariant(reportId: number, variant: AudienceVariant): Promise<ReportVariant | null> {
  const db = getDb()
  const result = await db.query.reportVariants.findFirst({
    where: and(eq(reportVariants.reportId, reportId), eq(reportVariants.variant, variant)),
  })
  return result ?? null
}

export function snapshotToDraftEvents(snapshots: ReportEventSnapshot[]) {
  return snapshots.map((snapshot) => ({
    id: snapshot.rawEventId ?? snapshot.id,
    eventTime: snapshot.eventTime,
    source: snapshot.source,
    content: snapshot.content,
    metadata: snapshot.metadata,
    projectScope: snapshot.projectScope,
    leadershipIncluded: snapshot.leadershipIncluded,
    personalIncluded: snapshot.personalIncluded,
  }))
}
