import { getDb, schema } from './db'
import { eq } from 'drizzle-orm'
import type { NewTag } from './db/schema'

const BUILT_IN_TAGS: Omit<NewTag, 'createdAt' | 'updatedAt'>[] = [
  { name: '工作', sectionType: 'routine', color: 'blue', isBuiltIn: true },
  { name: '成果', sectionType: 'achievement', color: 'green', isBuiltIn: true },
  { name: '风险', sectionType: 'risk', color: 'red', isBuiltIn: true },
  { name: '计划', sectionType: 'plan', color: 'yellow', isBuiltIn: true },
  { name: '会议', sectionType: 'routine', color: 'purple', isBuiltIn: true },
  { name: '重要', sectionType: 'achievement', color: 'orange', isBuiltIn: true },
]

export async function initializeBuiltInTags(): Promise<void> {
  const db = getDb()
  const now = new Date()
  
  try {
    const existingBuiltIn = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.isBuiltIn, true))
    
    if (existingBuiltIn.length > 0) {
      console.log('Built-in tags already exist, skipping initialization')
      return
    }
    
    await db.insert(schema.tags).values(
      BUILT_IN_TAGS.map(tag => ({
        ...tag,
        createdAt: now,
        updatedAt: now,
      }))
    )
    
    console.log(`Successfully initialized ${BUILT_IN_TAGS.length} built-in tags`)
  } catch (error) {
    console.error('Error initializing tags:', error)
    throw error
  }
}