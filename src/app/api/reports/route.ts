import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { reports } from '@/lib/db/schema'
import { reportSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    
    const offset = (page - 1) * pageSize
    
    const allReports = await db.query.reports.findMany({
      orderBy: [desc(reports.createdAt)],
      limit: pageSize,
      offset,
    })
    
    const totalResult = await db.select().from(reports)
    const total = totalResult.length
    
    return NextResponse.json({
      reports: allReports,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    return NextResponse.json(
      { error: '获取周报列表失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    
    const validated = reportSchema.parse(body)
    
    const now = new Date()
    const result = await db.insert(reports).values({
      ...validated,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '创建周报失败', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}