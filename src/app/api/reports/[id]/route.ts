import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  generationMessageParts,
  generationProposals,
  generationSessions,
  generationTurns,
  reportEventSnapshots,
  reportVariants,
  reports,
} from '@/lib/db/schema'
import { getReportBundle } from '@/lib/reports/service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reportId = Number.parseInt((await params).id, 10)
    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: '无效的周报ID', code: 'INVALID_ID' }, { status: 400 })
    }

    const bundle = await getReportBundle(reportId)
    if (!bundle) {
      return NextResponse.json({ error: '周报不存在', code: 'NOT_FOUND' }, { status: 404 })
    }

    const variants = bundle.variants.length > 0 ? bundle.variants : [{
      id: -bundle.id,
      reportId: bundle.id,
      variant: 'personal' as const,
      sourceDraft: '- 本周暂无事件',
      finalContent: bundle.content,
      finalStatus: 'current' as const,
      templateId: null,
      templateName: null,
      templateContent: null,
      aiStyle: bundle.aiStyleOverride,
      acceptedProposalId: null,
      sourceRevision: 0,
      scoreStatus: bundle.scoreStatus,
      scoreStructure: bundle.scoreStructure,
      scoreContent: bundle.scoreContent,
      scoreValue: bundle.scoreValue,
      scoreOverall: bundle.scoreOverall,
      suggestions: bundle.suggestions,
      scoreError: bundle.scoreError,
      scoredAt: bundle.scoredAt,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    }]
    const personal = variants.find((variant) => variant.variant === 'personal')
    return NextResponse.json({
      ...bundle,
      variants,
      content: personal?.finalContent ?? personal?.sourceDraft ?? bundle.content,
    })
  } catch (error) {
    console.error('GET /api/reports/[id] error:', error)
    return NextResponse.json({ error: '获取周报失败', code: 'FETCH_ERROR' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reportId = Number.parseInt((await params).id, 10)
    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: '无效的周报ID', code: 'INVALID_ID' }, { status: 400 })
    }
    const body = await request.json()
    const db = getDb()
    const existing = await db.query.reports.findFirst({ where: eq(reports.id, reportId) })
    if (!existing) {
      return NextResponse.json({ error: '周报不存在', code: 'NOT_FOUND' }, { status: 404 })
    }

    const updated = await db.update(reports).set({
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : existing.title,
      updatedAt: new Date(),
    }).where(eq(reports.id, reportId)).returning()

    return NextResponse.json(updated[0])
  } catch {
    return NextResponse.json({ error: '更新周报失败', code: 'UPDATE_ERROR' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reportId = Number.parseInt((await params).id, 10)
    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: '无效的周报ID', code: 'INVALID_ID' }, { status: 400 })
    }

    const db = getDb()
    const existing = await db.query.reports.findFirst({ where: eq(reports.id, reportId) })
    if (!existing) {
      return NextResponse.json({ error: '周报不存在', code: 'NOT_FOUND' }, { status: 404 })
    }

    const sessionRows = await db.select({ id: generationSessions.id })
      .from(generationSessions)
      .where(eq(generationSessions.reportId, reportId))
    for (const session of sessionRows) {
      const acceptedProposal = await db.select({ id: generationProposals.id })
        .from(generationProposals)
        .where(and(eq(generationProposals.sessionId, session.id), eq(generationProposals.status, 'accepted')))
        .limit(1)
      if (acceptedProposal.length > 0) {
        return NextResponse.json({ error: '周报包含已确认终版的生成审计记录，请保留记录或先归档会话', code: 'AUDIT_RECORD_REQUIRED' }, { status: 409 })
      }
    }

    db.transaction((tx) => {
      const sessions = tx.select({ id: generationSessions.id })
        .from(generationSessions)
        .where(eq(generationSessions.reportId, reportId))
        .all()
      for (const session of sessions) {
        tx.delete(generationProposals).where(eq(generationProposals.sessionId, session.id)).run()
        tx.delete(generationMessageParts).where(eq(generationMessageParts.sessionId, session.id)).run()
        tx.delete(generationTurns).where(eq(generationTurns.sessionId, session.id)).run()
      }
      tx.delete(generationSessions).where(eq(generationSessions.reportId, reportId)).run()
      tx.delete(reportEventSnapshots).where(eq(reportEventSnapshots.reportId, reportId)).run()
      tx.delete(reportVariants).where(eq(reportVariants.reportId, reportId)).run()
      tx.delete(reports).where(eq(reports.id, reportId)).run()
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '删除周报失败', code: 'DELETE_ERROR' }, { status: 500 })
  }
}
