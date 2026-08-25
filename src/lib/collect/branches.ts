import type { CollectSourceConfig } from '@/lib/db/schema'

export type BranchConfigValue = NonNullable<CollectSourceConfig['branches']>[number]
export type NormalizedBranch = { name: string; lastCommitTime: string | null }

/** Normalize edited branch names while preserving cursors by exact name. */
export function mergeEditedBranches(
  existing: CollectSourceConfig['branches'] | undefined,
  edited: BranchConfigValue[] | undefined,
): NormalizedBranch[] | undefined {
  if (!edited || edited.length === 0) return undefined

  const cursorByName = new Map<string, string | null>()
  for (const branch of existing || []) {
    const name = typeof branch === 'string' ? branch.trim() : branch.name.trim()
    if (!name || cursorByName.has(name)) continue
    cursorByName.set(name, typeof branch === 'string' ? null : branch.lastCommitTime || null)
  }

  const result: NormalizedBranch[] = []
  for (const branch of edited) {
    const name = (typeof branch === 'string' ? branch : branch.name).trim()
    if (!name || result.some(item => item.name === name)) continue
    result.push({ name, lastCommitTime: cursorByName.get(name) || null })
  }
  return result.length > 0 ? result : undefined
}
