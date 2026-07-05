import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { rawEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { parseTags } from '@/lib/tags/parser'
import { mapTagsToSectionType } from '@/lib/tags/mapper'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid event ID' },
        { status: 400 }
      )
    }
    
    const event = await db.select()
      .from(rawEvents)
      .where(eq(rawEvents.id, id))
      .limit(1)
    
    if (event.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    
    const body = await request.json()
    const updateData: Record<string, any> = { updatedAt: new Date() }
    
    if (body.content) {
      const { content, tags } = parseTags(body.content)
      updateData.content = content
      updateData.tags = tags
      updateData.sectionType = await mapTagsToSectionType(tags)
    }
    
    if (body.eventTime) {
      updateData.eventTime = new Date(body.eventTime)
    }
    
    if (body.isImportant !== undefined) {
      updateData.isImportant = body.isImportant
    }
    
    const updated = await db.update(rawEvents)
      .set(updateData)
      .where(eq(rawEvents.id, id))
      .returning()
    
    return NextResponse.json(updated[0])
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: '更新事件失败', code: 'UPDATE_ERROR' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid event ID' },
        { status: 400 }
      )
    }
    
    const event = await db.select()
      .from(rawEvents)
      .where(eq(rawEvents.id, id))
      .limit(1)
    
    if (event.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    
    if (event[0].source !== 'manual') {
      return NextResponse.json(
        { error: 'Cannot delete non-manual event' },
        { status: 403 }
      )
    }
    
    await db.delete(rawEvents)
      .where(eq(rawEvents.id, id))
      .returning()
    
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: '删除事件失败', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}