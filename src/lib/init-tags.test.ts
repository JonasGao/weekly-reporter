import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, schema } from './db'
import { initializeBuiltInTags } from './init-tags'
import { eq } from 'drizzle-orm'
import Database from 'better-sqlite3'
import { DB_PATH } from './paths'

describe('initializeBuiltInTags', () => {
  beforeAll(async () => {
    const db = getDb()

    const sqlite = new Database(DB_PATH)
    
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          name text NOT NULL UNIQUE,
          section_type text,
          color text,
          is_built_in integer DEFAULT false,
          created_at integer NOT NULL,
          updated_at integer NOT NULL
        )
      `)
    } catch (error) {
    } finally {
      sqlite.close()
    }
  })

  afterAll(async () => {
    const db = getDb()
    await db
      .delete(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))
  })

  it('should insert built-in tags when table is empty', async () => {
    const db = getDb()
    await db
      .delete(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))

    await initializeBuiltInTags()

    const builtInTags = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))

    expect(builtInTags.length).toBe(6)

    const names = builtInTags.map(t => t.name)
    expect(names).toContain('工作')
    expect(names).toContain('成果')
    expect(names).toContain('风险')
    expect(names).toContain('计划')
    expect(names).toContain('会议')
    expect(names).toContain('重要')

    expect(builtInTags.every(t => t.isBuiltIn === true)).toBe(true)
    expect(builtInTags.every(t => t.createdAt instanceof Date)).toBe(true)
    expect(builtInTags.every(t => t.updatedAt instanceof Date)).toBe(true)
  })

  it('should not insert duplicates when called multiple times', async () => {
    const db = getDb()

    await db
      .delete(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))

    await initializeBuiltInTags()
    const count1 = (await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))).length

    await initializeBuiltInTags()
    const count2 = (await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))).length

    expect(count1).toBe(6)
    expect(count2).toBe(6)
    expect(count1).toBe(count2)
  })

  it('should have correct sectionType mapping', async () => {
    const db = getDb()

    await db
      .delete(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))

    await initializeBuiltInTags()

    const tags = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))

    const tagMap = new Map(tags.map(t => [t.name, t.sectionType]))
    
    expect(tagMap.get('工作')).toBe('routine')
    expect(tagMap.get('成果')).toBe('achievement')
    expect(tagMap.get('风险')).toBe('risk')
    expect(tagMap.get('计划')).toBe('plan')
    expect(tagMap.get('会议')).toBe('routine')
    expect(tagMap.get('重要')).toBe('achievement')
  })
})