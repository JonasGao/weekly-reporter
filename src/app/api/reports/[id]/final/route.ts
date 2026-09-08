import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { generationMessageParts, generationProposals, generationSessions, reportVariants, reports } from '@/lib/db/schema'
import { triggerAsyncScoring, triggerAsyncVariantScoring } from '@/lib/scoring'
import { normalizeStructureCompletenessRule } from '@/lib/reports/structure-completeness'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reportId = Number.parseInt((await params).id, 10)
    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: 'Invalid report ID', code: 'INVALID_ID' }, { status: 400 })
    }

    const body = await request.json()
    const variant = body.variant === 'leadership' || body.variant === 'personal' ? body.variant : null
    if (
      !variant
      || typeof body.content !== 'string'
      || !body.content.trim()
    ) {
      return NextResponse.json({ error: 'Final content and audience variant are required', code: 'INVALID_INPUT' }, { status: 400 })
    }

    const db = getDb()
    const existing = await db.query.reportVariants.findFirst({
      where: and(eq(reportVariants.reportId, reportId), eq(reportVariants.variant, variant)),
    })
    if (!existing && variant === 'personal') {
      const legacy = await db.query.reports.findFirst({ where: eq(reports.id, reportId) })
      if (!legacy) return NextResponse.json({ error: 'Report not found', code: 'NOT_FOUND' }, { status: 404 })
      const now = new Date()
      const updated = await db.update(reports).set({
        content: body.content.trim(),
        scoreStatus: 'pending',
        scoreStructure: null,
        scoreContent: null,
        scoreValue: null,
        scoreOverall: null,
        suggestions: null,
        scoreError: null,
        scoredAt: null,
        updatedAt: now,
      }).where(eq(reports.id, reportId)).returning()
      triggerAsyncScoring(reportId).catch((error) => console.error('[reports] Legacy scoring failed:', error))
      return NextResponse.json(updated[0])
    }
    if (!existing) {
      return NextResponse.json({ error: 'Report variant not found', code: 'VARIANT_NOT_FOUND' }, { status: 404 })
    }
    if (body.sourceRevision != null && (!Number.isInteger(body.sourceRevision) || existing.sourceRevision !== body.sourceRevision)) {
      return NextResponse.json(
        { error: 'The source draft has changed. Regenerate the final version from the latest draft.', code: 'SOURCE_REVISION_CONFLICT' },
        { status: 409 },
      )
    }

    const now = new Date()
    const finalValues = {
      finalContent: body.content.trim(),
      finalStatus: 'current',
      structureCompletenessRule: normalizeStructureCompletenessRule(
        existing.structureCompletenessRule,
        existing.templateContent,
      ),
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
    const updated = db.transaction((tx) => {
      const updatedVariant = tx.update(reportVariants)
        .set(finalValues)
        .where(eq(reportVariants.id, existing.id))
        .returning()
        .get()
      if (!updatedVariant) return null
      if (variant === 'personal') {
        tx.update(reports).set({ content: updatedVariant.finalContent ?? '', updatedAt: now }).where(eq(reports.id, reportId)).run()
      }
      if (existing.acceptedProposalId != null) {
        const proposal = tx.select().from(generationProposals).where(eq(generationProposals.id, existing.acceptedProposalId)).get()
        const session = proposal && tx.select().from(generationSessions).where(
          and(eq(generationSessions.id, proposal.sessionId), eq(generationSessions.reportId, reportId)),
        ).get()
        if (session) {
          const last = tx.select({ sequence: generationMessageParts.sequence })
            .from(generationMessageParts)
            .where(eq(generationMessageParts.sessionId, session.id))
            .orderBy(desc(generationMessageParts.sequence))
            .limit(1)
            .get()
          tx.insert(generationMessageParts).values({
            sessionId: session.id,
            turnId: null,
            sequence: (last?.sequence ?? 0) + 1,
            role: 'application',
            partType: 'text',
            content: '会话基线后的用户编辑。',
            data: { event: 'direct-final-edit', variant },
            createdAt: now,
          })
          tx.update(generationSessions).set({ baselineFinalContent: updatedVariant.finalContent, updatedAt: now })
            .where(eq(generationSessions.id, session.id))
            .run()
        }
      }
      return updatedVariant
    })()
    if (updated) {
      triggerAsyncVariantScoring(updated.id).catch((error) => {
        console.error('[reports] Variant scoring failed:', error)
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save final version', code: 'SAVE_FINAL_ERROR', details: String(error) },
      { status: 500 },
    )
  }
}
