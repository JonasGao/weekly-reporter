import { getDb } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { collectSources, rawEvents } from '@/lib/db/schema'
import type { CollectSource } from '@/lib/db/schema'
import { getAdapter } from './adapters'
import type { FetchCommitsOptions } from './types'

export interface SyncResult {
  sourceId: number
  sourceName: string
  status: 'success' | 'failed'
  commitsCount: number
  eventsCount: number
  error?: string
}

export async function syncSource(sourceId: number): Promise<SyncResult> {
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
  
  if (!source.enabled) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: 'failed',
      commitsCount: 0,
      eventsCount: 0,
      error: '采集源已禁用',
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
    const options: FetchCommitsOptions = {
      config: source.config,
      since: source.lastSyncAt || undefined,
      until: new Date(),
    }
    
    const commits = await adapter.fetchCommits(options)
    
    const events = commits.map(c => adapter.normalizeCommit(c, source.type))
    
    const existingEvents = await db.query.rawEvents.findMany({
      where: eq(rawEvents.source, source.type),
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
      commitsCount: commits.length,
      eventsCount: newEvents.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    
    await db.update(collectSources)
      .set({
        lastSyncStatus: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(collectSources.id, source.id))
    
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: 'failed',
      commitsCount: 0,
      eventsCount: 0,
      error: errorMessage,
    }
  }
}

export async function syncAllSources(): Promise<SyncResult[]> {
  const db = getDb()
  
  const sources = await db.query.collectSources.findMany({
    where: eq(collectSources.enabled, true),
  })
  
  const results: SyncResult[] = []
  
  for (const source of sources) {
    const result = await syncSource(source.id)
    results.push(result)
  }
  
  return results
}