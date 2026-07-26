'use server'

import { readdirSync, existsSync } from 'fs'
import { resolve, join, basename } from 'path'
import { getDb } from '@/lib/db'
import { collectSources } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getRepoIdentity, planScanAdditions, sourcePaths } from '@/lib/collect/repo-identity'
import { toPaths, expandInputPath } from '@/lib/collect/paths'

const ALLOWED_BASE_DIRS = [
  process.env.HOME || '/home',
  '/opt',
  '/srv',
  '/var',
  '/tmp',
]

function isPathAllowed(path: string): boolean {
  const resolvedPath = resolve(path)
  return ALLOWED_BASE_DIRS.some(baseDir => resolvedPath.startsWith(baseDir))
}

interface FoundRepo {
  path: string
  name: string
  alreadyAdded: boolean
  /** 非空表示该目录与已有源同仓库，添加时将作为路径并入该源 */
  mergeTargetSourceId?: number
  mergeTargetSourceName?: string
  /** 同源分组键（规范化 origin URL），用于批量添加时同组建单源；null 表示无 origin */
  groupKey: string | null
}

function scanForGitRepos(basePath: string, maxDepth: number): string[] {
  const repos: string[] = []

  function scan(currentPath: string, currentDepth: number) {
    if (currentDepth > maxDepth) return

    if (!existsSync(currentPath)) return

    const gitDir = join(currentPath, '.git')
    // .git 为目录（常规仓库）或文件（worktree / submodule 工作树）都算 git 仓库
    if (existsSync(gitDir)) {
      repos.push(currentPath)
      return
    }

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scan(join(currentPath, entry.name), currentDepth + 1)
        }
      }
    } catch (error) {
    }
  }

  scan(basePath, 0)
  return repos
}

export async function scanRepos(
  basePath: string,
  maxDepth: number = 3
): Promise<{ repos: FoundRepo[]; error?: string }> {
  try {
    const resolvedPath = expandInputPath(basePath)

    if (!isPathAllowed(resolvedPath)) {
      return { repos: [], error: '不允许访问此目录' }
    }

    if (!existsSync(resolvedPath)) {
      return { repos: [], error: '目录不存在' }
    }

    const db = getDb()
    const existingSources = await db.query.collectSources.findMany({
      where: eq(collectSources.type, 'git-local'),
    })

    // 已有源的仓库身份（origin URL 规范化），单次扫描内逐个计算
    const existing = await Promise.all(
      existingSources.map(async s => ({
        id: s.id,
        name: s.name,
        identity: await getRepoIdentity(s.config.owner),
        paths: sourcePaths(s),
      }))
    )

    const foundPaths = scanForGitRepos(resolvedPath, maxDepth)
    const found = await Promise.all(
      foundPaths.map(async path => ({
        path,
        identity: await getRepoIdentity(path),
      }))
    )

    const dispositions = planScanAdditions(found, existing)

    const repos: FoundRepo[] = found.map((f, i) => {
      const d = dispositions[i]
      return {
        path: f.path,
        name: basename(f.path),
        alreadyAdded: d.kind === 'already-added',
        mergeTargetSourceId: d.kind === 'merge' ? d.targetSourceId : undefined,
        mergeTargetSourceName: d.kind === 'merge' ? d.targetSourceName : undefined,
        groupKey: d.kind === 'create' ? d.groupKey : null,
      }
    })

    return { repos }
  } catch (error) {
    return {
      repos: [],
      error: error instanceof Error ? error.message : '扫描失败',
    }
  }
}

export async function batchAddSources(
  repos: Array<{
    path: string
    name: string
    authorEmails: string[]
    mergeTargetSourceId?: number
    groupKey?: string | null
  }>
): Promise<{ success: boolean; addedCount: number; mergedCount: number; error?: string }> {
  try {
    const db = getDb()
    const now = new Date()
    let addedCount = 0
    let mergedCount = 0

    // 1. 并入已有源：给目标源追加采集路径（旧 branches 模型同步转换为 paths）
    const mergeItems = repos.filter(r => r.mergeTargetSourceId)
    const mergeBySource = new Map<number, string[]>()
    for (const item of mergeItems) {
      const list = mergeBySource.get(item.mergeTargetSourceId!) || []
      list.push(item.path)
      mergeBySource.set(item.mergeTargetSourceId!, list)
    }

    for (const [sourceId, paths] of mergeBySource) {
      const source = await db.query.collectSources.findFirst({
        where: eq(collectSources.id, sourceId),
      })
      if (!source) continue

      const existing = toPaths(source.config)
      const knownPaths = new Set(existing.map(p => p.path))
      const appended = paths
        .filter(p => !knownPaths.has(p))
        .map(p => ({ path: p, lastBranch: null, lastCommitTime: null }))

      if (appended.length === 0) continue

      // 移除 branches 字段，完成向 paths 模型的转换
      const nextConfig = { ...source.config, paths: [...existing, ...appended] }
      delete nextConfig.branches
      await db.update(collectSources)
        .set({
          config: nextConfig,
          updatedAt: now,
        })
        .where(eq(collectSources.id, sourceId))

      mergedCount += appended.length
    }

    // 2. 新建源：同 groupKey（同仓库）的目录只建一个源，其余作为路径并入
    const createItems = repos.filter(r => !r.mergeTargetSourceId)
    const groups = new Map<string | number, typeof createItems>()
    createItems.forEach((item, index) => {
      const key: string | number = item.groupKey ?? `__solo_${index}`
      const list = groups.get(key) || []
      list.push(item)
      groups.set(key, list)
    })

    for (const items of groups.values()) {
      const [primary, ...rest] = items
      await db.insert(collectSources).values({
        type: 'git-local',
        name: primary.name,
        config: {
          owner: primary.path,
          authorEmails: primary.authorEmails,
          paths: [primary, ...rest].map(r => ({
            path: r.path,
            lastBranch: null,
            lastCommitTime: null,
          })),
        },
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      addedCount += 1
      mergedCount += rest.length
    }

    return { success: true, addedCount, mergedCount }
  } catch (error) {
    return {
      success: false,
      addedCount: 0,
      mergedCount: 0,
      error: error instanceof Error ? error.message : '批量添加失败',
    }
  }
}

/**
 * 检查一个本地仓库路径的仓库身份，以及是否与其他已有源同仓库。
 * 用于编辑表单手动添加路径时的同源提示。
 */
export async function checkRepoPath(
  path: string,
  excludeSourceId?: number
): Promise<{ identity: string | null; matchedSourceId?: number; matchedSourceName?: string }> {
  const identity = await getRepoIdentity(expandInputPath(path))
  if (!identity) return { identity: null }

  const db = getDb()
  const existingSources = await db.query.collectSources.findMany({
    where: eq(collectSources.type, 'git-local'),
  })

  for (const source of existingSources) {
    if (excludeSourceId && source.id === excludeSourceId) continue
    const sourceIdentity = await getRepoIdentity(source.config.owner)
    if (sourceIdentity === identity) {
      return { identity, matchedSourceId: source.id, matchedSourceName: source.name }
    }
  }

  return { identity }
}
