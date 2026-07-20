import { eq } from 'drizzle-orm'
import { aiConfig, type AIConfig, type AIProtocol, type NewAIConfig } from '@/lib/db/schema'
import type { getDb } from '@/lib/db'

type DB = ReturnType<typeof getDb>

export interface AIConfigInput {
  protocol?: AIProtocol
  apiUrl: string
  apiKey: string
  model: string
}

export async function isAIConfigured(db: DB): Promise<boolean> {
  const rows = await db.select().from(aiConfig).limit(1)
  return rows.length > 0
}

export async function getAIConfig(db: DB): Promise<AIConfig | null> {
  const rows = await db.select().from(aiConfig).limit(1)
  return rows[0] ?? null
}

export async function saveAIConfig(db: DB, input: AIConfigInput): Promise<AIConfig> {
  const existing = await db.select().from(aiConfig).limit(1)
  const now = new Date()

  if (existing.length > 0) {
    const updated = await db
      .update(aiConfig)
      .set({
        protocol: input.protocol ?? 'openai',
        apiUrl: input.apiUrl,
        apiKey: input.apiKey,
        model: input.model,
        updatedAt: now,
      })
      .where(eq(aiConfig.id, existing[0].id))
      .returning()
    return updated[0]
  }

  const created = await db
    .insert(aiConfig)
    .values({
      protocol: input.protocol ?? 'openai',
      apiUrl: input.apiUrl,
      apiKey: input.apiKey,
      model: input.model,
      createdAt: now,
      updatedAt: now,
    } satisfies NewAIConfig)
    .returning()
  return created[0]
}

export async function clearAIConfig(db: DB): Promise<void> {
  await db.delete(aiConfig)
}

export async function updateModelListCache(
  db: DB,
  models: string[] | null,
): Promise<void> {
  const existing = await db.select().from(aiConfig).limit(1)
  if (existing.length === 0) return

  const now = new Date()
  await db
    .update(aiConfig)
    .set({
      modelListCache: models,
      modelListCachedAt: models ? now : null,
      updatedAt: now,
    })
    .where(eq(aiConfig.id, existing[0].id))
}

