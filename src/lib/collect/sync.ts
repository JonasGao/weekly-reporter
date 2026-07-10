import { getDb } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'
import { collectSources, rawEvents } from '@/lib/db/schema'
import type { CollectSource } from '@/lib/db/schema'
import { getAdapter } from './adapters'
import type { FetchCommitsOptions } from './types'
import { basename } from 'path'

export interface SyncResult {
  sourceId: number
  sourceName: string
  status: 'success' | 'failed'
  commitsCount: number
  eventsCount: number
  error?: string
  autoDisabled?: boolean
}

export async function syncSource(sourceId: number, resync?: boolean): Promise<SyncResult> {
  const db = getDb()
  
  const source = await db.query.collectSources.findFirst({
    where: eq(collectSources.id, sourceId),
  })
  
  if (!source) {
    return {
      sourceId,
      sourceName: '',
      status: 'failed',
      commitsCount: 0,
      eventsCount: 0,
      error: '采集源不存在',
    }
  }
  
  if (source.status !== 'enabled') {
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: 'failed',
      commitsCount: 0,
      eventsCount: 0,
      error: source.status === 'disabled' ? '采集源已禁用' : '采集源不可用',
    }
  }
  
  const adapter = getAdapter(source.type)
  if (!adapter) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: 'failed',
      commitsCount: 0,
      eventsCount: 0,
      error: '不支持的采集源类型',
    }
  }
  
  try {
    // Get branches to sync - default to single empty branch for backward compatibility
    const branches = source.config.branches?.length ? source.config.branches : ['']

    // 构建仓库显示名：本地取路径 basename，远程取 owner/repo
    const repoName = source.config.repo
      ? `${source.config.owner}/${source.config.repo}`
      : basename(source.config.owner)

    let allCommits: Awaited<ReturnType<typeof adapter.fetchCommits>> = []

    // Sync each branch
    for (const branch of branches) {
      const options: FetchCommitsOptions = {
        config: {
          ...source.config,
          branch: branch || undefined,
        },
        // resync 模式下不传 since，全量拉取后靠 SHA 去重
        since: resync ? undefined : (source.lastSyncAt || undefined),
        until: new Date(),
      }

      const commits = await adapter.fetchCommits(options)
      allCommits = allCommits.concat(commits)
    }

    const sourceInfo = {
      repo: repoName,
      branch: branches[0] || '',
      sourceId: source.id,
      sourceName: source.name,
    }

    const events = allCommits.map(c => adapter.normalizeCommit(c, source.type, sourceInfo))

    // 按 sourceId 去重
    const existingEvents = await db.query.rawEvents.findMany({
      where: sql`json_extract(${rawEvents.metadata}, '$.sourceId') = ${source.id}`,
    })
    const existingShaSet = new Set(
      existingEvents
        .filter(e => e.metadata?.sha)
        .map(e => e.metadata?.sha)
    )

    const newEvents = events.filter(e => !existingShaSet.has(e.metadata?.sha))
    
    const now = new Date()
    if (newEvents.length > 0) {
      await db.insert(rawEvents).values(
        newEvents.map(e => ({
          ...e,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        }))
      )
    }
    
    await db.update(collectSources)
      .set({
        lastSyncAt: now,
        lastSyncStatus: 'success',
        updatedAt: now,
      })
      .where(eq(collectSources.id, source.id))
    
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: 'success',
      commitsCount: allCommits.length,
      eventsCount: newEvents.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'

    // Check if the error is due to missing/invalid directory for local git sources
    const isUnavailable = source.type === 'git-local' && (
      errorMessage.includes('路径不是 Git 仓库') ||
      errorMessage.includes('not a git repository') ||
      errorMessage.includes('no such file or directory') ||
      errorMessage.includes('ENOENT')
    )

    if (isUnavailable) {
      await db.update(collectSources)
        .set({
          status: 'unavailable',
          lastSyncStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(collectSources.id, source.id))
    } else {
      await db.update(collectSources)
        .set({
          lastSyncStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(collectSources.id, source.id))
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      status: 'failed',
      commitsCount: 0,
      eventsCount: 0,
      error: errorMessage,
      autoDisabled: isUnavailable,
    }
  }
}

export async function syncAllSources(resync?: boolean): Promise<SyncResult[]> {
  const db = getDb()

  const sources = await db.query.collectSources.findMany({
    where: eq(collectSources.status, 'enabled'),
  })

  // 过滤掉没有配置邮箱的采集源（和单个同步按钮行为一致）
  const eligibleSources = sources.filter(source =>
    source.config?.authorEmails && source.config.authorEmails.length > 0
  )

  const results: SyncResult[] = []

  for (const source of eligibleSources) {
    const result = await syncSource(source.id, resync)
    results.push(result)
  }

  return results
}