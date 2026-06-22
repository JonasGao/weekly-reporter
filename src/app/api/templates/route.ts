import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { templateSchema } from '@/lib/validations'

export async function GET() {
  try {
    const db = getDb()
    const allTemplates = await db.select().from(templates)
    return NextResponse.json({ templates: allTemplates })
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
      ...validated,
      isDefault: false,
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