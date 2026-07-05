import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, schema } from '@/lib/db'
import { mapTagsToSectionType } from './mapper'
import { eq } from 'drizzle-orm'

describe('mapTagsToSectionType', () => {
  beforeAll(async () => {
    const db = getDb()
    
    await db
      .delete(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))
    
    await db.insert(schema.tags).values([
      { name: '工作', sectionType: 'routine', color: 'blue', isBuiltIn: true, createdAt: new Date(), updatedAt: new Date() },
      { name: '成果', sectionType: 'achievement', color: 'green', isBuiltIn: true, createdAt: new Date(), updatedAt: new Date() },
      { name: '风险', sectionType: 'risk', color: 'red', isBuiltIn: true, createdAt: new Date(), updatedAt: new Date() },
      { name: '计划', sectionType: 'plan', color: 'yellow', isBuiltIn: true, createdAt: new Date(), updatedAt: new Date() },
    ])
  })

  afterAll(async () => {
    const db = getDb()
    await db
      .delete(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))
  })

  it('should return routine when no tags provided', async () => {
    const result = await mapTagsToSectionType([])
    expect(result).toBe('routine')
  })

  it('should map achievement tag correctly', async () => {
    const result = await mapTagsToSectionType(['成果'])
    expect(result).toBe('achievement')
  })

  it('should map risk tag correctly', async () => {
    const result = await mapTagsToSectionType(['风险'])
    expect(result).toBe('risk')
  })

  it('should map plan tag correctly', async () => {
    const result = await mapTagsToSectionType(['计划'])
    expect(result).toBe('plan')
  })

  it('should map routine tag correctly', async () => {
    const result = await mapTagsToSectionType(['工作'])
    expect(result).toBe('routine')
  })

  it('should return routine when tag not found', async () => {
    const result = await mapTagsToSectionType(['未知标签'])
    expect(result).toBe('routine')
  })

  it('should prioritize achievement over other tags', async () => {
    const result = await mapTagsToSectionType(['工作', '成果', '风险'])
    expect(result).toBe('achievement')
  })

  it('should prioritize risk over plan and routine', async () => {
    const result = await mapTagsToSectionType(['工作', '计划', '风险'])
    expect(result).toBe('risk')
  })

  it('should prioritize plan over routine', async () => {
    const result = await mapTagsToSectionType(['工作', '计划'])
    expect(result).toBe('plan')
  })

  it('should handle multiple tags with same section type', async () => {
    const result = await mapTagsToSectionType(['工作', '会议'])
    expect(result).toBe('routine')
  })

  it('should handle tags with special characters', async () => {
    const db = getDb()
    await db.insert(schema.tags).values({
      name: '测试-标签',
      sectionType: 'achievement',
      color: 'purple',
      isBuiltIn: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const result = await mapTagsToSectionType(['测试-标签'])
    expect(result).toBe('achievement')

    await db.delete(schema.tags).where(eq(schema.tags.name, '测试-标签'))
  })
})