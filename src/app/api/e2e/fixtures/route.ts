import { NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { format, startOfWeek, subDays } from 'date-fns'
import { getDb } from '@/lib/db'
import {
  generationMessageParts,
  generationProposals,
  generationSessions,
  generationTurns,
  rawEvents,
  reportEventSnapshots,
  reportVariants,
  reports,
} from '@/lib/db/schema'

export const runtime = 'nodejs'

type FixtureReport = { id: number; kind: 'current' | 'stale' | 'legacy' }

function enabled() {
  return process.env.E2E_FIXTURES === '1'
}

export async function POST(request: Request) {
  if (!enabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => null) as { action?: string; marker?: string } | null
  if (!body || !['historical', 'timeline'].includes(body.action ?? '') || typeof body.marker !== 'string' || !body.marker.trim()) {
    return NextResponse.json({ error: 'A marker and historical action are required', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const marker = body.marker.trim().slice(0, 120)
  const db = getDb()
  const now = new Date()
  const rows: FixtureReport[] = []
  if (body.action === 'timeline') {
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 })
    const previousWeekEnd = subDays(currentWeekStart, 1)
    const previousWeekStart = subDays(currentWeekStart, 7)
    const weekStart = format(previousWeekStart, 'yyyy-MM-dd')
    const weekEnd = format(previousWeekEnd, 'yyyy-MM-dd')
    const report = db.insert(reports).values({
      title: `${marker} timeline history`,
      content: `# ${marker} timeline history`,
      weekStart,
      weekEnd,
      scoreStatus: 'completed',
      createdAt: now,
      updatedAt: now,
    }).returning().get()
    db.insert(reportVariants).values([
      {
        reportId: report.id,
        variant: 'leadership' as const,
        sourceDraft: `- ${marker} leadership source`,
        finalContent: `## 下周计划\n- ${marker} leadership plan\n## 下周计划\n- ${marker} ignored duplicate`,
        finalStatus: 'current' as const,
        sourceRevision: 1,
        scoreStatus: 'completed' as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        reportId: report.id,
        variant: 'personal' as const,
        sourceDraft: `- ${marker} personal source`,
        finalContent: `## 下周计划\n- ${marker} personal plan`,
        finalStatus: 'current' as const,
        sourceRevision: 1,
        scoreStatus: 'completed' as const,
        createdAt: now,
        updatedAt: now,
      },
    ]).run()
    rows.push({ id: report.id, kind: 'current' })

    const staleReport = db.insert(reports).values({
      title: `${marker} stale timeline history`,
      content: `# ${marker} stale timeline history`,
      weekStart,
      weekEnd,
      scoreStatus: 'completed',
      createdAt: now,
      updatedAt: now,
    }).returning().get()
    db.insert(reportVariants).values(['leadership', 'personal'].map((variant) => ({
      reportId: staleReport.id,
      variant: variant as 'leadership' | 'personal',
      sourceDraft: `- ${marker} stale source`,
      finalContent: `## 下周计划\n- ${marker} stale excluded`,
      finalStatus: 'stale' as const,
      sourceRevision: 1,
      scoreStatus: 'completed' as const,
      createdAt: now,
      updatedAt: now,
    }))).run()
    rows.push({ id: staleReport.id, kind: 'stale' })

    const legacyReport = db.insert(reports).values({
      title: `${marker} legacy timeline history`,
      content: `## 下周计划\n- ${marker} legacy excluded`,
      weekStart: format(subDays(previousWeekStart, 7), 'yyyy-MM-dd'),
      weekEnd: format(subDays(previousWeekStart, 1), 'yyyy-MM-dd'),
      scoreStatus: 'completed',
      createdAt: now,
      updatedAt: now,
    }).returning().get()
    rows.push({ id: legacyReport.id, kind: 'legacy' })
    return NextResponse.json({ reports: rows }, { status: 201 })
  }

  const createModern = (kind: 'current' | 'stale') => {
    const report = db.insert(reports).values({
      title: `${marker} ${kind} history`,
      content: `# ${kind} history`,
      weekStart: kind === 'current' ? '2026-12-21' : '2026-12-14',
      weekEnd: kind === 'current' ? '2026-12-27' : '2026-12-20',
      scoreStatus: 'completed',
      createdAt: now,
      updatedAt: now,
    }).returning().get()
    const finalStatus = kind === 'current' ? 'current' as const : 'stale' as const
    db.insert(reportVariants).values(['leadership', 'personal'].map((variant) => ({
      reportId: report.id,
      variant: variant as 'leadership' | 'personal',
      sourceDraft: `- ${marker} ${variant} source`,
      finalContent: `# ${marker} ${variant} final`,
      finalStatus,
      sourceRevision: 1,
      scoreStatus: 'completed' as const,
      scoreOverall: 80,
      createdAt: now,
      updatedAt: now,
    }))).run()
    rows.push({ id: report.id, kind })
  }
  createModern('current')
  createModern('stale')
  const legacy = db.insert(reports).values({
    title: `${marker} legacy history`,
    content: `# ${marker} legacy final`,
    weekStart: '2026-12-07',
    weekEnd: '2026-12-13',
    scoreStatus: 'completed',
    scoreOverall: 70,
    createdAt: now,
    updatedAt: now,
  }).returning().get()
  rows.push({ id: legacy.id, kind: 'legacy' })
  return NextResponse.json({ reports: rows }, { status: 201 })
}

export async function DELETE(request: Request) {
  if (!enabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => null) as { reportIds?: unknown; eventIds?: unknown } | null
  const ids = Array.isArray(body?.reportIds) ? body.reportIds.filter((value): value is number => Number.isInteger(value) && value > 0) : []
  const eventIds = Array.isArray(body?.eventIds) ? body.eventIds.filter((value): value is number => Number.isInteger(value) && value > 0) : []
  if (ids.length === 0 && eventIds.length === 0) return NextResponse.json({ deleted: 0 })
  const db = getDb()
  db.transaction((tx) => {
    if (ids.length > 0) {
      const sessions = tx.select({ id: generationSessions.id }).from(generationSessions).where(inArray(generationSessions.reportId, ids)).all()
      for (const session of sessions) {
        tx.delete(generationProposals).where(eq(generationProposals.sessionId, session.id)).run()
        tx.delete(generationMessageParts).where(eq(generationMessageParts.sessionId, session.id)).run()
        tx.delete(generationTurns).where(eq(generationTurns.sessionId, session.id)).run()
      }
      tx.delete(generationSessions).where(inArray(generationSessions.reportId, ids)).run()
      tx.delete(reportEventSnapshots).where(inArray(reportEventSnapshots.reportId, ids)).run()
      tx.delete(reportVariants).where(inArray(reportVariants.reportId, ids)).run()
      tx.delete(reports).where(inArray(reports.id, ids)).run()
    }
    if (eventIds.length > 0) tx.delete(rawEvents).where(inArray(rawEvents.id, eventIds)).run()
  })
  return NextResponse.json({ deleted: ids.length + eventIds.length })
}
