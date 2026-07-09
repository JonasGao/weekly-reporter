import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { desc, isNull } from 'drizzle-orm'
import { like, and, eq } from 'drizzle-orm'
import { collectSources } from '@/lib/db/schema'
import { collectSourceSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const name = searchParams.get('name') || ''
    const syncStatus = searchParams.get('syncStatus') || ''
    const sourceStatus = searchParams.get('sourceStatus') || ''

    const offset = (page - 1) * pageSize

    const conditions = []
    if (name) {
      conditions.push(like(collectSources.name, `%${name}%`))
    }
    if (syncStatus === 'success' || syncStatus === 'failure') {
      conditions.push(eq(collectSources.lastSyncStatus, syncStatus))
    } else if (syncStatus === 'never') {
      conditions.push(isNull(collectSources.lastSyncAt))
    }
    if (sourceStatus === 'enabled' || sourceStatus === 'disabled' || sourceStatus === 'unavailable') {
      conditions.push(eq(collectSources.status, sourceStatus))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const sources = await db.query.collectSources.findMany({
      where: whereClause,
      orderBy: [desc(collectSources.createdAt)],
      limit: pageSize,
      offset,
    })

    const totalResult = await db.select({ id: collectSources.id }).from(collectSources).where(whereClause)
    const total = totalResult.length

    return NextResponse.json({
      sources: sources.map(s => ({
        ...s,
        config: {
          ...s.config,
          token: '[ENCRYPTED]',
        },
      })),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[API] Failed to fetch collect sources:', error)
    return NextResponse.json(
      { error: '获取采集源列表失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    
    const validated = collectSourceSchema.parse(body)
    
    const now = new Date()
    const result = await db.insert(collectSources).values({
      ...validated,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json({
      ...result[0],
      config: {
        ...result[0].config,
        token: '[ENCRYPTED]',
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[API] Failed to create collect source:', error)
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '创建采集源失败', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}