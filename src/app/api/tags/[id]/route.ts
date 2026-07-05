import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { tags } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { SectionType } from '@/lib/db/schema'

const VALID_SECTION_TYPES: SectionType[] = ['achievement', 'risk', 'routine', 'plan']

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid tag ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }

    const db = getDb()
    const existingTag = await db
      .select()
      .from(tags)
      .where(eq(tags.id, id))
      .limit(1)

    if (existingTag.length === 0) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: '请求体格式无效', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    const { name, sectionType, color } = body

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json(
          { error: '标签名称不能为空', code: 'INVALID_NAME' },
          { status: 400 }
        )
      }
    }

    if (sectionType !== undefined && !VALID_SECTION_TYPES.includes(sectionType)) {
      return NextResponse.json(
        { error: '无效的分类类型', code: 'INVALID_SECTION_TYPE' },
        { status: 400 }
      )
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (name !== undefined) updateData.name = name.trim()
    if (sectionType !== undefined) updateData.sectionType = sectionType
    if (color !== undefined) updateData.color = color

    const updated = await db
      .update(tags)
      .set(updateData)
      .where(eq(tags.id, id))
      .returning()

    return NextResponse.json(updated[0])
  } catch (error) {
    console.error('Error updating tag:', error)
    return NextResponse.json(
      { error: '更新标签失败', code: 'UPDATE_ERROR' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid tag ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }

    const db = getDb()
    const existingTag = await db
      .select()
      .from(tags)
      .where(eq(tags.id, id))
      .limit(1)

    if (existingTag.length === 0) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      )
    }

    if (existingTag[0].isBuiltIn) {
      return NextResponse.json(
        { error: 'Cannot delete built-in tag' },
        { status: 403 }
      )
    }

    await db.delete(tags).where(eq(tags.id, id)).returning()
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json(
      { error: '删除标签失败', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}