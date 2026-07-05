import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { tags } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import type { SectionType } from '@/lib/db/schema'

const VALID_SECTION_TYPES: SectionType[] = ['achievement', 'risk', 'routine', 'plan']

export async function GET() {
  try {
    const db = getDb()
    const allTags = await db.select().from(tags).orderBy(desc(tags.createdAt))
    return NextResponse.json(allTags)
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json(
      { error: '获取标签列表失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, sectionType, color } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: '标签名称不能为空', code: 'INVALID_NAME' },
        { status: 400 }
      )
    }

    if (sectionType && !VALID_SECTION_TYPES.includes(sectionType)) {
      return NextResponse.json(
        { error: '无效的分类类型', code: 'INVALID_SECTION_TYPE' },
        { status: 400 }
      )
    }

    const db = getDb()
    const now = new Date()
    const newTag = await db.insert(tags).values({
      name: name.trim(),
      sectionType: sectionType || 'routine',
      color: color || null,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    }).returning()

    return NextResponse.json(newTag[0], { status: 201 })
  } catch (error) {
    console.error('Error creating tag:', error)
    return NextResponse.json(
      { error: '创建标签失败', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}