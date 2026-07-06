import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { rawEvents, tags } from '@/lib/db/schema'
import { sql, eq } from 'drizzle-orm'

export async function GET() {
  try {
    const db = getDb()
    
    const stats = await db
      .select({
        name: tags.name,
        color: tags.color,
        usage_count: sql<number>`count(${rawEvents.id})`.as('usage_count'),
      })
      .from(tags)
      .leftJoin(rawEvents, sql`json_array_length(${rawEvents.tags}) > 0 AND exists(select 1 from json_each(${rawEvents.tags}) where json_each.value = ${tags.name})`)
      .groupBy(tags.id, tags.name, tags.color)
      .orderBy(sql`usage_count DESC`)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching tag stats:', error)
    return NextResponse.json(
      { error: '获取标签统计失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}