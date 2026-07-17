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

    // Check alias uniqueness across all sources (excluding current source's own aliases)
    if (validated.aliases && validated.aliases.length > 0) {
      const allSources = await db.query.collectSources.findMany()
      const existingAliases = new Set(
        allSources
          .filter(s => s.id !== sourceId) // exclude current source
          .flatMap(s => (s.config.aliases as string[]) || [])
      )
      const duplicates = validated.aliases.filter(a => existingAliases.has(a))
      if (duplicates.length > 0) {
        return NextResponse.json(
          { error: `别名已被使用: ${duplicates.join(', ')}`, code: 'DUPLICATE_ALIAS' },
          { status: 400 }
        )
      }
    }

    // 检查邮箱配置：如果没有邮箱，状态自动设为 unavailable
    const hasEmails = validated.config?.authorEmails && validated.config.authorEmails.length > 0
    const newStatus = hasEmails
      ? (validated.enabled === false ? 'disabled' : 'enabled')
      : 'unavailable'

    const result = await db.update(collectSources)
      .set({
        ...validated,
        status: newStatus,
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

export async function PATCH(
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

    const existing = await db.query.collectSources.findFirst({
      where: eq(collectSources.id, sourceId),
    })

    if (!existing) {
      return NextResponse.json(
        { error: '采集源不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // 只允许 PATCH 已知的安全字段
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if ('enabled' in body) updates.enabled = Boolean(body.enabled)
    if ('status' in body) {
      const validStatuses = ['enabled', 'disabled', 'unavailable']
      if (validStatuses.includes(body.status)) {
        updates.status = body.status
      }
    }

    const result = await db.update(collectSources)
      .set(updates)
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