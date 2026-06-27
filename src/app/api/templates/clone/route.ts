import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'
import { cloneTemplateSchema } from '@/lib/validations'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const validated = cloneTemplateSchema.parse(body)
    
    let sourceTemplate: { name: string; content: string; id: string } | null = null
    
    // 根据sourceId前缀判断来源
    if (validated.sourceId.startsWith('official-')) {
      sourceTemplate = OFFICIAL_TEMPLATES.find(t => t.id === validated.sourceId)
    } else if (validated.sourceId.startsWith('user-')) {
      const userId = parseInt(validated.sourceId.replace('user-', ''))
      const userTemplate = await db.select().from(templates).where(eq(templates.id, userId))
      if (userTemplate.length > 0) {
        sourceTemplate = {
          id: validated.sourceId,
          name: userTemplate[0].name,
          content: userTemplate[0].content,
        }
      }
    }
    
    if (!sourceTemplate) {
      return NextResponse.json(
        { error: '源模板不存在', code: 'TEMPLATE_NOT_FOUND' },
        { status: 400 }
      )
    }
    
    const now = new Date()
    const newTemplate = {
      name: validated.name || sourceTemplate.name,
      content: validated.content || sourceTemplate.content,
      description: undefined,
      tags: undefined,
      sourceTemplateId: validated.sourceId,
      createdAt: now,
      updatedAt: now,
    }
    
    const result = await db.insert(templates).values(newTemplate).returning()
    
    return NextResponse.json({
      template: result[0],
      message: '模板已克隆成功',
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: '数据验证失败', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    return NextResponse.json({ error: '克隆模板失败', code: 'CLONE_ERROR' }, { status: 500 })
  }
}