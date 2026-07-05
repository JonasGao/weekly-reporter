import { getDb } from '@/lib/db'
import { schema } from '@/lib/db'
import { sql } from 'drizzle-orm'
import type { SectionType, Tag } from '@/lib/db/schema'

export async function mapTagsToSectionType(tagNames: string[]): Promise<SectionType> {
  if (tagNames.length === 0) return 'routine'
  
  const db = getDb()
  const tagRecords = await db.select()
    .from(schema.tags)
    .where(sql`${schema.tags.name} IN ${sql.raw(`(${tagNames.map(() => '?').join(',')})`)}`)
  
  const priority: SectionType[] = ['achievement', 'risk', 'plan', 'routine']
  
  for (const p of priority) {
    if (tagRecords.some((t: Tag) => t.sectionType === p)) {
      return p
    }
  }
  
  return 'routine'
}