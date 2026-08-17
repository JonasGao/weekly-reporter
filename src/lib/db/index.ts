import Database from 'better-sqlite3'
import path from 'path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { DB_PATH, ensureDataDir } from '../paths'
import * as schema from './schema'
import { applyDatabaseMigrations } from './migrations'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    ensureDataDir()
    const sqlite = new Database(DB_PATH)

    try {
      applyDatabaseMigrations(sqlite, path.join(process.cwd(), 'drizzle'))
      db = drizzle(sqlite, { schema })
    } catch (error) {
      sqlite.close()
      throw new Error('Database migration failed', { cause: error })
    }
  }

  if (!db) {
    throw new Error('Database initialization failed')
  }

  return db
}

export { schema }
