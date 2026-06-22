import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { templateSchema } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const template = await db.select().from(templates).where(eq(templates.id, parseInt(id)))
    
    if (template.length === 0) {
      return NextResponse.json({ error: '模板不存在', code: 'NOT_FOUND' }, { status: 404 })
    }
    
    return NextResponse.json({ template: template[0] })
  } catch (error) {
    return NextResponse.json(
      { error: '获取模板失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const body = await request.json()
    
    const validated = templateSchema.parse(body)
    
    const template = await db.select().from(templates).where(eq(templates.id, parseInt(id)))
    
    if (template.length === 0) {
      return NextResponse.json({ error: '模板不存在', code: 'NOT_FOUND' }, { status: 404 })
    }
    
    if (template[0].isDefault) {
      return NextResponse.json({ error: '默认模板不可修改', code: 'FORBIDDEN' }, { status: 400 })
    }
    
    const updated = await db.update(templates)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, parseInt(id)))
      .returning()
    
    return NextResponse.json({ template: updated[0] })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '更新模板失败', code: 'UPDATE_ERROR' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const template = await db.select().from(templates).where(eq(templates.id, parseInt(id)))
    
    if (template.length === 0) {
      return NextResponse.json({ error: '模板不存在', code: 'NOT_FOUND' }, { status: 404 })
    }
    
    if (template[0].isDefault) {
      return NextResponse.json({ error: '默认模板不可删除', code: 'FORBIDDEN' }, { status: 400 })
    }
    
    await db.delete(templates).where(eq(templates.id, parseInt(id)))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: '删除模板失败', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}