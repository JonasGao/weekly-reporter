import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, schema } from './db'
import { initializeSnippets } from './init-snippets'
import { eq } from 'drizzle-orm'
import Database from 'better-sqlite3'
import { DB_PATH } from './paths'

describe('initializeSnippets', () => {
  beforeAll(async () => {
    // Ensure database is initialized and table exists
    const db = getDb()

    // Manually create sentence_snippets table if it doesn't exist
    // This is necessary for tests since migrations might not have run
    const sqlite = new Database(DB_PATH)
    
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS sentence_snippets (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          content text NOT NULL,
          category text DEFAULT '通用' NOT NULL,
          is_built_in integer DEFAULT false NOT NULL,
          created_at integer NOT NULL,
          updated_at integer NOT NULL
        )
      `)
    } catch (error) {
      // Table might already exist
    } finally {
      sqlite.close()
    }
  })

  afterAll(async () => {
    // Clean up: remove all built-in snippets after tests
    const db = getDb()
    try {
      await db
        .delete(schema.sentenceSnippets)
        .where(eq(schema.sentenceSnippets.isBuiltIn, true))
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  it('should insert built-in snippets when table is empty', async () => {
    // Clean up before test
    const db = getDb()
    await db
      .delete(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.isBuiltIn, true))

    // Run initialization
    await initializeSnippets()

    // Verify snippets were inserted
    const builtInSnippets = await db
      .select()
      .from(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.isBuiltIn, true))

    // Should have 30 total snippets
    expect(builtInSnippets.length).toBe(30)

    // Verify category distribution
    const categories = builtInSnippets.map(s => s.category)
    const categoryCounts = categories.reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    expect(categoryCounts['成果']).toBe(10)
    expect(categoryCounts['问题']).toBe(8)
    expect(categoryCounts['计划']).toBe(6)
    expect(categoryCounts['量化']).toBe(6)

    // Verify all snippets are marked as built-in
    expect(builtInSnippets.every(s => s.isBuiltIn === true)).toBe(true)

    // Verify all snippets have content
    expect(builtInSnippets.every(s => s.content.length > 0)).toBe(true)

    // Verify timestamps are set
    expect(builtInSnippets.every(s => s.createdAt instanceof Date)).toBe(true)
    expect(builtInSnippets.every(s => s.updatedAt instanceof Date)).toBe(true)
  })

  it('should not insert duplicates when called multiple times', async () => {
    const db = getDb()

    // Clean up before test
    await db
      .delete(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.isBuiltIn, true))

    // First initialization
    await initializeSnippets()
    const count1 = (await db
      .select()
      .from(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.isBuiltIn, true))).length

    // Second initialization
    await initializeSnippets()
    const count2 = (await db
      .select()
      .from(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.isBuiltIn, true))).length

    // Count should be the same
    expect(count1).toBe(30)
    expect(count2).toBe(30)
    expect(count1).toBe(count2)
  })

  it('should have meaningful content in each category', async () => {
    const db = getDb()

    // Clean up before test
    await db
      .delete(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.isBuiltIn, true))

    // Run initialization
    await initializeSnippets()

    // Get snippets by category
    const achievementSnippets = await db
      .select()
      .from(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.category, '成果'))

    const problemSnippets = await db
      .select()
      .from(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.category, '问题'))

    const planSnippets = await db
      .select()
      .from(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.category, '计划'))

    const quantificationSnippets = await db
      .select()
      .from(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.category, '量化'))

    // Verify achievement snippets are relevant
    expect(achievementSnippets.length).toBe(10)
    achievementSnippets.forEach(s => {
      expect(s.content.length).toBeGreaterThan(10)
      expect(s.content).toMatch(/完成|优化|解决|推动|编写|参与/)
    })

    // Verify problem snippets are relevant
    expect(problemSnippets.length).toBe(8)
    problemSnippets.forEach(s => {
      expect(s.content.length).toBeGreaterThan(10)
      expect(s.content).toMatch(/遇到|问题|延迟|困难|不足|异常|需要|沟通|不畅|兼容|理解|不够|理想|资源|影响/)
    })

    // Verify plan snippets are relevant
    expect(planSnippets.length).toBe(6)
    planSnippets.forEach(s => {
      expect(s.content.length).toBeGreaterThan(10)
      expect(s.content).toMatch(/计划|将|下周/)
    })

    // Verify quantification snippets have numbers
    expect(quantificationSnippets.length).toBe(6)
    quantificationSnippets.forEach(s => {
      expect(s.content.length).toBeGreaterThan(10)
      expect(s.content).toMatch(/\d+/) // Should contain numbers
    })
  })
})