import { NextResponse } from 'next/server'
import { getDb, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { triggerAsyncScoring } from '@/lib/scoring'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const reportId = parseInt(id, 10)
    
    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: 'Invalid report ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const report = await db.query.reports.findFirst({
      where: eq(schema.reports.id, reportId),
    })
    
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    if (report.scoreStatus === 'scoring') {
      return NextResponse.json(
        { error: 'Scoring already in progress', code: 'SCORING_IN_PROGRESS' },
        { status: 400 }
      )
    }
    
    await db.update(schema.reports)
      .set({
        scoreStatus: 'pending',
        scoreError: null,
      })
      .where(eq(schema.reports.id, reportId))
    
    triggerAsyncScoring(reportId).catch(err => {
      console.error('[rescore] Async scoring failed:', err)
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[rescore] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}