import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { reportVariants, reports } from '@/lib/db/schema'
import { triggerAsyncVariantScoring } from '@/lib/scoring'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reportId = Number.parseInt((await params).id, 10)
    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: '无效的周报ID', code: 'INVALID_ID' }, { status: 400 })
    }

    const body = await request.json()
    const variant = body.variant === 'leadership' || body.variant === 'personal' ? body.variant : null
    if (
      !variant
      || typeof body.content !== 'string'
      || !body.content.trim()
      || !Number.isInteger(body.sourceRevision)
    ) {
      return NextResponse.json({ error: '终版内容、受众版本和原稿版本不能为空', code: 'INVALID_INPUT' }, { status: 400 })
    }

    const db = getDb()
    const existing = await db.query.reportVariants.findFirst({
      where: and(eq(reportVariants.reportId, reportId), eq(reportVariants.variant, variant)),
    })
    if (!existing) {
      return NextResponse.json({ error: '周报版本不存在', code: 'VARIANT_NOT_FOUND' }, { status: 404 })
    }
    if (existing.sourceRevision !== body.sourceRevision) {
      return NextResponse.json(
        { error: '原稿已更新，请基于最新原稿重新生成终版', code: 'SOURCE_REVISION_CONFLICT' },
        { status: 409 },
      )
    }

    const now = new Date()
    const finalValues = {
      finalContent: body.content.trim(),
      finalStatus: 'current',
      templateId: typeof body.templateId === 'string' ? body.templateId : existing?.templateId ?? null,
      templateName: typeof body.templateName === 'string' ? body.templateName : existing?.templateName ?? null,
      templateContent: typeof body.templateContent === 'string' ? body.templateContent : existing?.templateContent ?? null,
      aiStyle: typeof body.aiStyle === 'string' ? body.aiStyle : existing?.aiStyle ?? null,
      acceptedProposalId: null,
      scoreStatus: 'pending',
      scoreStructure: null,
      scoreContent: null,
      scoreValue: null,
      scoreOverall: null,
      suggestions: null,
      scoreError: null,
      scoredAt: null,
      updatedAt: now,
    } as const
    const updated = await db.update(reportVariants)
      .set(finalValues)
      .where(eq(reportVariants.id, existing.id))
      .returning()

    if (updated[0]) {
      if (variant === 'personal') {
        await db.update(reports).set({ content: updated[0].finalContent ?? '', updatedAt: now }).where(eq(reports.id, reportId))
      }
      triggerAsyncVariantScoring(updated[0].id).catch((error) => {
        console.error('[reports] Variant scoring failed:', error)
      })
    }

    return NextResponse.json(updated[0])
  } catch (error) {
    return NextResponse.json(
      { error: '保存终版失败', code: 'SAVE_FINAL_ERROR', details: String(error) },
      { status: 500 },
    )
  }
}
