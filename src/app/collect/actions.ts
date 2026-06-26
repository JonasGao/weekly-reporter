'use server'

import { readdirSync, statSync, existsSync } from 'fs'
import { resolve, join, basename } from 'path'
import { getDb } from '@/lib/db'
import { collectSources } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

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
    if (existsSync(gitDir) && statSync(gitDir).isDirectory()) {
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
    const resolvedPath = resolve(basePath)
    
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
    
    const existingPaths = new Set(
      existingSources.map(s => s.config.owner)
    )
    
    const foundPaths = scanForGitRepos(resolvedPath, maxDepth)
    
    const repos: FoundRepo[] = foundPaths.map(path => ({
      path,
      name: basename(path),
      alreadyAdded: existingPaths.has(path),
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
  repos: Array<{ path: string; name: string; authorEmails: string[] }>
): Promise<{ success: boolean; addedCount: number; error?: string }> {
  try {
    const db = getDb()
    const now = new Date()
    
    const values = repos.map(repo => ({
      type: 'git-local',
      name: repo.name,
      config: {
        owner: repo.path,
        authorEmails: repo.authorEmails,
      },
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }))
    
    const result = await db.insert(collectSources).values(values).returning()
    
    return {
      success: true,
      addedCount: result.length,
    }
  } catch (error) {
    return {
      success: false,
      addedCount: 0,
      error: error instanceof Error ? error.message : '批量添加失败',
    }
  }
}