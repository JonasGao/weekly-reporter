import { getDb } from '@/lib/db'
import { collectSources } from '@/lib/db/schema'
import type { ProjectScope } from '@/lib/db/schema'

/**
 * 来源分组排序所需的采集源项目范围映射（采集源 id → 项目范围）。
 * 映射中缺失的 sourceId（采集源已删除）会被归入其他组。
 */
export async function getSourceScopes(): Promise<Map<number, ProjectScope>> {
  const db = getDb()
  const sources = await db
    .select({ id: collectSources.id, projectScope: collectSources.projectScope })
    .from(collectSources)
  return new Map(sources.map((s) => [s.id, s.projectScope]))
}
