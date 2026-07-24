import { getRemoteUrl } from './adapters/local-git-adapter'
import { normalizeRepoName } from '@/lib/utils'
import type { CollectSource } from '@/lib/db/schema'

/**
 * 仓库身份：规范化后的 origin URL。无 origin 的纯本地仓库返回 null，
 * 不参与同源合并（各自独立成源）。
 */
export async function getRepoIdentity(repoPath: string): Promise<string | null> {
  const remoteUrl = await getRemoteUrl(repoPath)
  if (!remoteUrl) return null
  return normalizeRepoName(remoteUrl) || null
}

/** 源的所有已知路径（paths 模型）或主路径（旧模型） */
export function sourcePaths(source: Pick<CollectSource, 'config'>): string[] {
  const paths = source.config.paths
  if (Array.isArray(paths) && paths.length > 0) {
    return paths.map(p => p.path)
  }
  return [source.config.owner]
}

export interface FoundRepoInput {
  path: string
  identity: string | null
}

export interface ExistingSourceInput {
  id: number
  name: string
  identity: string | null
  paths: string[]
}

export type ScanDisposition =
  | { kind: 'already-added' }
  | { kind: 'merge'; targetSourceId: number; targetSourceName: string }
  | { kind: 'create'; groupKey: string | null }

/**
 * 扫描结果处置规划（纯函数）：
 * - 路径已存在于某源 → already-added
 * - identity 命中已有源 → merge 到该源
 * - 其余按 identity 分组：同组共享 groupKey（由调用方保证同组只建一个源）；
 *   identity 为 null 的各自独立 create（groupKey 为 null）
 */
export function planScanAdditions(
  found: FoundRepoInput[],
  existingSources: ExistingSourceInput[],
): ScanDisposition[] {
  return found.map(repo => {
    for (const source of existingSources) {
      if (source.paths.includes(repo.path)) {
        return { kind: 'already-added' } as const
      }
    }
    if (repo.identity) {
      const target = existingSources.find(s => s.identity !== null && s.identity === repo.identity)
      if (target) {
        return { kind: 'merge', targetSourceId: target.id, targetSourceName: target.name } as const
      }
      return { kind: 'create', groupKey: repo.identity } as const
    }
    return { kind: 'create', groupKey: null } as const
  })
}
