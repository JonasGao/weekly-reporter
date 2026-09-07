import { NextResponse } from 'next/server'
import { getTimelinePlanProjection } from '@/lib/reports/timeline-plans'
import { isValid, parseISO } from 'date-fns'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const requestedWeekStart = new URL(request.url).searchParams.get('weekStart') ?? undefined
    if (requestedWeekStart && (!/^\d{4}-\d{2}-\d{2}$/.test(requestedWeekStart) || !isValid(parseISO(`${requestedWeekStart}T00:00:00`)))) {
      return NextResponse.json({ error: 'weekStart must be a valid YYYY-MM-DD date', code: 'INVALID_INPUT' }, { status: 400 })
    }
    return NextResponse.json(await getTimelinePlanProjection(new Date(), requestedWeekStart))
  } catch (error) {
    console.error('GET /api/timeline/plans error:', error)
    return NextResponse.json(
      { error: 'Failed to load timeline plans', code: 'FETCH_ERROR' },
      { status: 500 },
    )
  }
}
