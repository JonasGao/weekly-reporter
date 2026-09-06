import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { rawEvents, RawEvent } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

type EventUpdateData = Partial<Pick<RawEvent, 'content' | 'eventTime' | 'isImportant' | 'updatedAt'>>

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id: paramId } = await params
    const id = parseInt(paramId)
    
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
    
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }
    
    // Validate request body exists and has at least one field
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body cannot be empty', code: 'EMPTY_BODY' },
        { status: 400 }
      )
    }
    
    const updateData: EventUpdateData = { updatedAt: new Date() }
    
    // Validate content if provided
    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.trim().length === 0) {
        return NextResponse.json(
          { error: 'Content is required', code: 'INVALID_CONTENT' },
          { status: 400 }
        )
      }
      updateData.content = body.content
    }
    
    // Validate eventTime if provided
    if (body.eventTime !== undefined) {
      const parsedDate = new Date(body.eventTime)
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid event time', code: 'INVALID_EVENT_TIME' },
          { status: 400 }
        )
      }
      updateData.eventTime = parsedDate
    }
    
    // Validate isImportant if provided
    if (body.isImportant !== undefined) {
      if (typeof body.isImportant !== 'boolean') {
        return NextResponse.json(
          { error: 'isImportant must be a boolean', code: 'INVALID_IS_IMPORTANT' },
          { status: 400 }
        )
      }
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
      { error: 'Failed to update event', code: 'UPDATE_ERROR' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id: paramId } = await params
    const id = parseInt(paramId)
    
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
    
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}
