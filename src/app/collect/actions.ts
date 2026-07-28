'use server'

import { readdirSync, existsSync } from 'fs'
import { resolve, join, basename } from 'path'
import { getDb } from '@/lib/db'
import { collectSources } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { expandInputPath } from '@/lib/collect/paths'

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

    const knownPaths = new Set(existingSources.map(s => s.config.owner))
    const foundPaths = scanForGitRepos(resolvedPath, maxDepth)

    const repos: FoundRepo[] = foundPaths.map(path => ({
      path,
      name: basename(path),
      alreadyAdded: knownPaths.has(path),
    }))

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
  }>
): Promise<{ success: boolean; addedCount: number; error?: string }> {
  try {
    const db = getDb()
    const now = new Date()
    let addedCount = 0

    const existingSources = await db.query.collectSources.findMany({
      where: eq(collectSources.type, 'git-local'),
    })
    const knownPaths = new Set(existingSources.map(s => s.config.owner))

    for (const repo of repos) {
      if (knownPaths.has(repo.path)) continue

      await db.insert(collectSources).values({
        type: 'git-local',
        name: repo.name,
        config: {
          owner: repo.path,
          authorEmails: repo.authorEmails,
          branches: [],
        },
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      knownPaths.add(repo.path)
      addedCount += 1
    }

    return { success: true, addedCount }
  } catch (error) {
    return {
      success: false,
      addedCount: 0,
      error: error instanceof Error ? error.message : '批量添加失败',
    }
  }
}
