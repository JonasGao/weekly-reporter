import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { templateSchema } from '@/lib/validations'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'

export async function GET() {
  try {
    const db = getDb()
    const userTemplates = await db.select().from(templates)
    
    return NextResponse.json({
      official: OFFICIAL_TEMPLATES,
      user: userTemplates,
    })
  } catch (error) {
    return NextResponse.json(
      { error: '获取模板列表失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    
    const validated = templateSchema.parse(body)
    
    const now = new Date()
    const result = await db.insert(templates).values({
      name: validated.name,
      content: validated.content,
      description: validated.description,
      tags: validated.tags,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json({ template: result[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '创建模板失败', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}