import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { reports } from '@/lib/db/schema'
import { reportSchema } from '@/lib/validations'
import { triggerAsyncScoring } from '@/lib/scoring'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const reportId = parseInt(id)
    
    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: '无效的周报ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const report = await db.query.reports.findFirst({
      where: eq(reports.id, reportId),
    })
    
    if (!report) {
      return NextResponse.json(
        { error: '周报不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      { error: '获取周报失败', code: 'FETCH_ERROR' },
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
    const reportId = parseInt(id)
    
    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: '无效的周报ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const validated = reportSchema.parse(body)
    
    const existing = await db.query.reports.findFirst({
      where: eq(reports.id, reportId),
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: '周报不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    const contentChanged = existing.content !== validated.content
    
    const updateData: Record<string, unknown> = {
      ...validated,
      updatedAt: new Date(),
    }
    
    if (contentChanged) {
      updateData.scoreStatus = 'pending'
      updateData.scoreStructure = null
      updateData.scoreContent = null
      updateData.scoreValue = null
      updateData.scoreOverall = null
      updateData.suggestions = null
      updateData.scoreError = null
      updateData.scoredAt = null
    }
    
    const result = await db.update(reports)
      .set(updateData)
      .where(eq(reports.id, reportId))
      .returning()
    
    if (contentChanged && result[0] && existing.scoreStatus !== 'scoring') {
      triggerAsyncScoring(result[0].id).catch(err => {
        console.error('[reports] Async scoring failed:', err)
      })
    }
    
    return NextResponse.json(result[0])
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '更新周报失败', code: 'UPDATE_ERROR' },
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
    const reportId = parseInt(id)
    
    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: '无效的周报ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const existing = await db.query.reports.findFirst({
      where: eq(reports.id, reportId),
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: '周报不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    await db.delete(reports).where(eq(reports.id, reportId))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: '删除周报失败', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}