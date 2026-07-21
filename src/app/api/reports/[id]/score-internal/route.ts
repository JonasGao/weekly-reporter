import { NextResponse } from 'next/server'
import { triggerAsyncScoring } from '@/lib/scoring'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const reportId = parseInt(id, 10)
    
    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: 'Invalid report ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const result = await triggerAsyncScoring(reportId)
    
    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: result.error || 'Scoring failed', code: 'SCORING_ERROR' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[score-internal] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}