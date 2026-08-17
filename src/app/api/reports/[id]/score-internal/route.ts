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
    const variant = body.variant === 'leadership' || body.variant === 'personal' ? body.variant : null
    const db = getDb()
    if (variant) {
      const reportVariant = await db.query.reportVariants.findFirst({
        where: and(eq(schema.reportVariants.reportId, reportId), eq(schema.reportVariants.variant, variant)),
      })
      if (!reportVariant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
      const result = await triggerAsyncVariantScoring(reportVariant.id)
      return result.success ? NextResponse.json(result) : NextResponse.json(result, { status: 500 })
    }
    const result = await triggerAsyncScoring(reportId)
    return result.success ? NextResponse.json(result) : NextResponse.json(result, { status: 500 })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
