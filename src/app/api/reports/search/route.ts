import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { or, like, and, gte, lte } from 'drizzle-orm'
import { reports } from '@/lib/db/schema'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const conditions = []
    
    if (query) {
      conditions.push(
        or(
          like(reports.title, `%${query}%`),
          like(reports.content, `%${query}%`)
        )
      )
    }
    
    if (startDate) {
      conditions.push(gte(reports.weekStart, startDate))
    }
    
    if (endDate) {
      conditions.push(lte(reports.weekEnd, endDate))
    }
    
    const results = await db.query.reports.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: (reports, { desc }) => [desc(reports.createdAt)],
    })
    
    return NextResponse.json({ reports: results })
  } catch (error) {
    return NextResponse.json(
      { error: '搜索失败', code: 'SEARCH_ERROR' },
      { status: 500 }
    )
  }
}