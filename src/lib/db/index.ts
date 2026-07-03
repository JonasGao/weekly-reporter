import Database from 'better-sqlite3'
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
    
    // Skip migrations - schema has been manually updated already
    // Uncomment if you need to run migrations for a fresh database
    // try {
    //   migrate(db, { migrationsFolder: './drizzle' })
    // } catch (error) {
    //   console.error('Migration warning:', error)
    // }
  }
  
  if (!db) {
    throw new Error('Database initialization failed')
  }
  
  return db
}

export { schema }