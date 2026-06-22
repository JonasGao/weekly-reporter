import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { DB_PATH, ensureDataDir } from '../paths'
import * as schema from './schema'
import { DEFAULT_TEMPLATE_NAME, DEFAULT_TEMPLATE_CONTENT } from '../template-default'
import { eq } from 'drizzle-orm'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    ensureDataDir()
    const sqlite = new Database(DB_PATH)
    db = drizzle(sqlite, { schema })
    
    try {
      migrate(db, { migrationsFolder: './drizzle' })
    } catch (error) {
      console.error('Migration failed:', error)
    }
  }
  return db
}

export async function initializeDefaultTemplate() {
  const database = getDb()
  const existing = await database.select().from(schema.templates).where(eq(schema.templates.isDefault, true))
  
  if (existing.length === 0) {
    await database.insert(schema.templates).values({
      name: DEFAULT_TEMPLATE_NAME,
      content: DEFAULT_TEMPLATE_CONTENT,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}

export { schema }