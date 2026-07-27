import type { ProjectScope, RawEvent } from '@/lib/db/schema'

/**
 * 来源分组 (Origin Group)：创建周报时事件按来源划分的展示优先级分组。
 * 组间固定优先级：手动组 > 采集-工作组 > 采集-个人组 > 其他组。
 */
export type OriginGroup = 'manual' | 'work' | 'personal' | 'other'

export const ORIGIN_GROUP_RANK: Record<OriginGroup, number> = {
  manual: 0,
  work: 1,
  personal: 2,
  other: 3,
}

/**
 * 判定事件的来源分组。
 * - 无 sourceId → 手动组
 * - sourceId 命中 scope 映射 → 采集-工作组 / 采集-个人组
 * - sourceId 未命中（采集源已删除）→ 其他组
 */
export function getOriginGroup(
  event: RawEvent,
  sourceScopes?: ReadonlyMap<number, ProjectScope>
): OriginGroup {
  const sourceId = event.metadata?.sourceId
  if (sourceId == null) return 'manual'
  const scope = sourceScopes?.get(sourceId)
  if (scope === 'work') return 'work'
  if (scope === 'personal') return 'personal'
  return 'other'
}
