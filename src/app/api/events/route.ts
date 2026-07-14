import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { desc, eq, between, sql } from 'drizzle-orm'
import { rawEvents } from '@/lib/db/schema'
import { parseTags } from '@/lib/tags/parser'
import { mapTagsToSectionType } from '@/lib/tags/mapper'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')
    const weekEnd = searchParams.get('weekEnd')
    const dateParam = searchParams.get('date')
    const tagsParam = searchParams.get('tags')
    const sourceParam = searchParams.get('source')
    const status = searchParams.get('status') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const cursorId = searchParams.get('cursorId') ? parseInt(searchParams.get('cursorId')!) : null
    const cursorTime = searchParams.get('cursorTime') ? parseInt(searchParams.get('cursorTime')!) : null

    const conditions: ReturnType<typeof eq>[] = []
    if (status) {
      conditions.push(eq(rawEvents.status, status))
    }

    if (weekStart && weekEnd) {
      const start = new Date(weekStart)
      const end = new Date(weekEnd)
      end.setHours(23, 59, 59, 999)
      conditions.push(between(rawEvents.eventTime, start, end))
    }

    if (dateParam) {
      const dateObj = new Date(dateParam + 'T00:00:00')
      if (!isNaN(dateObj.getTime())) {
        const dayStart = new Date(dateObj)
        const dayEnd = new Date(dateObj)
        dayEnd.setHours(23, 59, 59, 999)
        conditions.push(between(rawEvents.eventTime, dayStart, dayEnd))
      }
    }

    if (tagsParam) {
      const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean)
      if (tags.length > 0) {
        const inClause = sql`(${sql.join(tags.map(t => sql`${t}`), sql`, `)})`
        conditions.push(sql`${rawEvents.tags} IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(${rawEvents.tags}) WHERE json_each.value IN ${inClause})`)
      }
    }

    // source 筛选：manual = 手动, auto = 非手动（自动采集）
    if (sourceParam) {
      if (sourceParam === 'manual') {
        conditions.push(eq(rawEvents.source, 'manual'))
      } else if (sourceParam === 'auto') {
        conditions.push(sql`${rawEvents.source} != 'manual'`)
      }
    }

    // 游标分页：基于 (eventTime, id) 复合排序
    // SQLite 中 eventTime 存为秒级时间戳，cursorTime 是毫秒，需要转换
    if (cursorId !== null && cursorTime !== null) {
      const cursorTimeSec = Math.floor(cursorTime / 1000)
      conditions.push(
        sql`((${rawEvents.eventTime} < ${cursorTimeSec}) OR (${rawEvents.eventTime} = ${cursorTimeSec} AND ${rawEvents.id} < ${cursorId}))`
      )
    }

    let query = db.select()
      .from(rawEvents)
      .$dynamic()
    if (conditions.length > 0) {
      query = query.where(sql.join(conditions, sql` AND `))
    }
    const events = await query
      .orderBy(desc(rawEvents.eventTime))
      .limit(limit + 1)

    const hasMore = events.length > limit
    const page = events.slice(0, limit)
    const last = page[page.length - 1]
    const nextCursor = last ? { id: last.id, eventTime: last.eventTime.getTime() } : null

    return NextResponse.json({ events: page, nextCursor, hasMore })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: '获取事件列表失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const { content, eventTime } = body
    
    // Validate content is required and non-empty
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: '内容不能为空', code: 'INVALID_CONTENT' },
        { status: 400 }
      )
    }
    
    // Validate eventTime format if provided
    if (eventTime !== undefined && eventTime !== null) {
      const parsedDate = new Date(eventTime)
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: '时间格式无效', code: 'INVALID_EVENT_TIME' },
          { status: 400 }
        )
      }
    }
    
    const { content: cleanContent, tags } = parseTags(content)
    const sectionType = await mapTagsToSectionType(tags)
    
    const now = new Date()
    const newEvent = await db.insert(rawEvents).values({
      content: cleanContent,
      tags,
      eventTime: eventTime ? new Date(eventTime) : now,
      source: 'manual',
      sectionType,
      status: 'pending',
      isImportant: false,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json(newEvent[0], { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: '创建事件失败', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}