import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../src/lib/db/schema'
import { DEFAULT_TEMPLATE_NAME, DEFAULT_TEMPLATE_CONTENT } from '../src/lib/template-default'
import { eq } from 'drizzle-orm'
import path from 'path'
import os from 'os'

const dataDir = path.join(os.homedir(), '.local', 'share', 'weekly-reporter')
const dbPath = path.join(dataDir, 'reports.db')

const sqlite = new Database(dbPath)
const db = drizzle(sqlite, { schema })

async function initializeDefaultTemplate() {
  const existing = await db.select().from(schema.templates).where(eq(schema.templates.isDefault, true))
  
  if (existing.length === 0) {
    await db.insert(schema.templates).values({
      name: DEFAULT_TEMPLATE_NAME,
      content: DEFAULT_TEMPLATE_CONTENT,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    console.log('Default template initialized')
  } else {
    console.log('Default template already exists')
  }
}

initializeDefaultTemplate()
  .catch((error) => console.error('Failed to initialize default template:', error))
  .finally(() => sqlite.close())