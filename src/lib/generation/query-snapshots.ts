import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { generationQuerySnapshots, generationSessions, reportVariants, type AudienceVariant, type GenerationQuerySnapshot } from '@/lib/db/schema'

export function persistQuerySnapshot(input: {
  sessionId: number
  toolName: string
  parameters: Record<string, unknown>
  result: Record<string, unknown>
  durationMs: number
  trigger?: 'automatic' | 'user'
  previousSnapshotId?: number | null
}): GenerationQuerySnapshot | null {
  try {
  const db = getDb()
  const session = db.select().from(generationSessions).where(eq(generationSessions.id, input.sessionId)).get()
  if (!session) return null
  const variant = db.select({ updatedAt: reportVariants.updatedAt }).from(reportVariants).where(eq(reportVariants.id, session.reportVariantId)).get()
  const result = input.result
  const count = Array.isArray(result.items) ? result.items.length : Array.isArray(result.matches) ? result.matches.length : result.found ? 1 : 0
  const truncated = result.truncated === true || result.matchesTruncated === true
  const errorCode = result.ok === false && result.error && typeof result.error === 'object' && 'code' in result.error ? String((result.error as { code: unknown }).code) : null
  const previous = input.previousSnapshotId ?? db.select({ id: generationQuerySnapshots.id }).from(generationQuerySnapshots)
    .where(and(eq(generationQuerySnapshots.sessionId, input.sessionId), eq(generationQuerySnapshots.toolName, input.toolName))).orderBy(desc(generationQuerySnapshots.id)).limit(1).get()?.id ?? null
  return db.insert(generationQuerySnapshots).values({
    sessionId: input.sessionId,
    toolName: input.toolName,
    parameters: input.parameters,
    calledAt: new Date(),
    sourceReportId: session.reportId,
    sourceAudience: session.variant as AudienceVariant,
    sourceUpdatedAt: variant?.updatedAt ?? null,
    result,
    resultCount: count,
    truncated,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    errorCode,
    trigger: input.trigger ?? 'automatic',
    previousSnapshotId: previous,
    createdAt: new Date(),
  }).returning().get()
  } catch (error) {
    console.error('[generation] query snapshot persistence failed:', error)
    return null
  }
}

export function listQuerySnapshots(sessionId: number) {
  try { return getDb().select().from(generationQuerySnapshots).where(eq(generationQuerySnapshots.sessionId, sessionId)).orderBy(generationQuerySnapshots.id).all() } catch { return [] }
}
