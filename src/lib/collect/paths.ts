import type { CollectSourceConfig, CollectSourcePath } from '@/lib/db/schema'
import { isAbsolute, resolve } from 'path'

export type PathEntry = Required<Pick<CollectSourcePath, 'path'>> & {
  lastBranch: string | null
  lastCommitTime: string | null
}

function normalizeEntry(entry: CollectSourcePath): PathEntry {
  return {
    path: entry.path,
    lastBranch: entry.lastBranch || null,
    lastCommitTime: entry.lastCommitTime || null,
  }
}

/**
 * 读取 git-local 源的采集路径。返回 null 表示源还是旧 branches 模型，
 * 调用方应走旧的按分支名同步逻辑。
 */
export function normalizePaths(config: CollectSourceConfig): PathEntry[] | null {
  if (!Array.isArray(config.paths) || config.paths.length === 0) {
    return null
  }
  return config.paths.map(normalizeEntry)
}

/**
 * 转换为 paths 模型：已有 paths 直接归一化返回；
 * 旧 branches 模型合成单条目（owner 路径），游标取各分支 cursor 最大值，
 * lastBranch 置 null 表示「未知分支」——首次同步采纳当前签出分支且不触发重置。
 */
export function toPaths(config: CollectSourceConfig): PathEntry[] {
  const existing = normalizePaths(config)
  if (existing) return existing
  return [{
    path: config.owner,
    lastBranch: null,
    lastCommitTime: maxBranchCursor(config.branches),
  }]
}

/** 旧 branches 配置中最大的 cursor */
export function maxBranchCursor(branches: CollectSourceConfig['branches']): string | null {
  if (!Array.isArray(branches)) return null
  let max: string | null = null
  for (const b of branches) {
    if (typeof b === 'object' && b !== null && b.lastCommitTime) {
      if (!max || b.lastCommitTime > max) max = b.lastCommitTime
    }
  }
  return max
}

/**
 * 是否需要重置该路径的游标：记录的分支非空且与当前签出分支不同。
 * lastBranch 为 null（新路径或旧数据转换而来）时不重置。
 */
export function shouldResetCursor(entry: PathEntry, currentBranch: string): boolean {
  return entry.lastBranch !== null && entry.lastBranch !== currentBranch
}

/**
 * 路径展开：把用户输入的目录路径解释为绝对路径。规则（见 CONTEXT.md「路径展开」）：
 * - `~` 或 `~/` 开头 → 展开为 $HOME（不支持 ~user 形式，按相对路径处理）
 * - 相对路径 → 解析到 $HOME 下
 * - 绝对路径 → 原样使用
 * 返回值经 resolve 规范化，但保留用户输入的结尾斜杠——
 * 调用方（如目录补全）用它区分「列出该目录内容」。
 */
export function expandInputPath(input: string): string {
  const home = process.env.HOME || '/home'
  const trimmed = input.trim()
  const expanded =
    trimmed === '~' ? home
    : trimmed.startsWith('~/') ? resolve(home, trimmed.slice(2))
    : isAbsolute(trimmed) ? resolve(trimmed)
    : resolve(home, trimmed)
  return trimmed.endsWith('/') && expanded !== '/' ? expanded + '/' : expanded
}
