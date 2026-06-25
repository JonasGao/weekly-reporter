import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { collectSources } from '@/lib/db/schema'
import { collectSourceSchema } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const sourceId = parseInt(id)
    
    if (isNaN(sourceId)) {
      return NextResponse.json(
        { error: '无效的采集源ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const source = await db.query.collectSources.findFirst({
      where: eq(collectSources.id, sourceId),
    })
    
    if (!source) {
      return NextResponse.json(
        { error: '采集源不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      ...source,
      config: {
        ...source.config,
        token: '[ENCRYPTED]',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: '获取采集源失败', code: 'FETCH_ERROR' },
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
    const sourceId = parseInt(id)
    
    if (isNaN(sourceId)) {
      return NextResponse.json(
        { error: '无效的采集源ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const validated = collectSourceSchema.parse(body)
    
    const existing = await db.query.collectSources.findFirst({
      where: eq(collectSources.id, sourceId),
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: '采集源不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    const result = await db.update(collectSources)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(collectSources.id, sourceId))
      .returning()
    
    return NextResponse.json({
      ...result[0],
      config: {
        ...result[0].config,
        token: '[ENCRYPTED]',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '更新采集源失败', code: 'UPDATE_ERROR' },
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
    const sourceId = parseInt(id)
    
    if (isNaN(sourceId)) {
      return NextResponse.json(
        { error: '无效的采集源ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const existing = await db.query.collectSources.findFirst({
      where: eq(collectSources.id, sourceId),
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: '采集源不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    await db.delete(collectSources).where(eq(collectSources.id, sourceId))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: '删除采集源失败', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}