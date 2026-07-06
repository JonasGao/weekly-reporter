import Database from 'better-sqlite3'
import path from 'path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { DB_PATH, ensureDataDir } from '../paths'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    ensureDataDir()
    const sqlite = new Database(DB_PATH)
    db = drizzle(sqlite, { schema })

    try {
      migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
    } catch (error) {
      console.error('[db] Migration failed:', error instanceof Error ? error.message : error)
    }
  }

  if (!db) {
    throw new Error('Database initialization failed')
  }

  return db
}

export { schema }