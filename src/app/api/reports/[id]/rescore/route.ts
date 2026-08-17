import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb, schema } from '@/lib/db'
import { triggerAsyncScoring, triggerAsyncVariantScoring } from '@/lib/scoring'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reportId = Number.parseInt((await params).id, 10)
    if (Number.isNaN(reportId)) return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
    const body = await request.json().catch(() => ({}))
    const variant = body.variant === 'leadership' || body.variant === 'personal' ? body.variant : 'personal'
    const db = getDb()
    const reportVariant = await db.query.reportVariants.findFirst({
      where: and(eq(schema.reportVariants.reportId, reportId), eq(schema.reportVariants.variant, variant)),
    })

    if (reportVariant?.finalContent) {
      await db.update(schema.reportVariants).set({ scoreStatus: 'pending', scoreError: null }).where(eq(schema.reportVariants.id, reportVariant.id))
      triggerAsyncVariantScoring(reportVariant.id).catch((error) => console.error('[rescore] Variant scoring failed:', error))
      return NextResponse.json({ success: true, variant })
    }

    const report = await db.query.reports.findFirst({ where: eq(schema.reports.id, reportId) })
    if (!report) return NextResponse.json({ error: 'Report not found', code: 'NOT_FOUND' }, { status: 404 })
    await db.update(schema.reports).set({ scoreStatus: 'pending', scoreError: null }).where(eq(schema.reports.id, reportId))
    triggerAsyncScoring(reportId).catch((error) => console.error('[rescore] Legacy scoring failed:', error))
    return NextResponse.json({ success: true, variant: 'legacy' })
  } catch (error) {
    console.error('[rescore] Error:', error)
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
