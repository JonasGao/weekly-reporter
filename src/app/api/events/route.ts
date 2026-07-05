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
        // Use parameterized query to prevent SQL injection
        // Create safe IN clause with proper parameter binding
        const inClause = sql`(${sql.join(tags.map(t => sql`${t}`), sql`, `)})`
        conditions.push(sql`${rawEvents.tags} IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(${rawEvents.tags}) WHERE json_each.value IN ${inClause})`)
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