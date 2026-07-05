import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { desc, eq, between, sql } from 'drizzle-orm'
import { rawEvents } from '@/lib/db/schema'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')
    const weekEnd = searchParams.get('weekEnd')
    const tagsParam = searchParams.get('tags')
    const status = searchParams.get('status') || 'pending'

    const conditions = [eq(rawEvents.status, status)]

    if (weekStart && weekEnd) {
      const start = new Date(weekStart)
      const end = new Date(weekEnd)
      end.setHours(23, 59, 59, 999)
      conditions.push(between(rawEvents.eventTime, start, end))
    }

    if (tagsParam) {
      const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean)
      if (tags.length > 0) {
        conditions.push(sql`${rawEvents.tags} IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(${rawEvents.tags}) WHERE json_each.value IN ${sql.raw(`(${tags.map(t => `'${t}'`).join(',')})`)})`)
      }
    }

    const events = await db.select()
      .from(rawEvents)
      .where(sql.join(conditions, sql` AND `))
      .orderBy(desc(rawEvents.eventTime))

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: '获取事件列表失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}