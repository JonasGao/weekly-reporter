import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { collectSources } from '@/lib/db/schema'
import { fetchOrigin } from './adapters/local-git-adapter'
import { SourceOperationBusyError, withSourceOperationLock } from './source-operation-lock'

export interface LocalFetchResult {
  sourceId: number
  sourceName: string
  status: 'success' | 'failed'
  error?: string
}

export async function fetchLocalSource(sourceId: number): Promise<LocalFetchResult> {
  const db = getDb()
  const source = await db.query.collectSources.findFirst({
    where: eq(collectSources.id, sourceId),
  })

  if (!source) {
    return { sourceId, sourceName: '', status: 'failed', error: '采集源不存在' }
  }

  if (source.type !== 'git-local') {
    return { sourceId, sourceName: source.name, status: 'failed', error: '仅支持本地 Git 来源' }
  }

  try {
    await withSourceOperationLock(source.id, () => fetchOrigin(source.config.owner))
    return { sourceId: source.id, sourceName: source.name, status: 'success' }
  } catch (error) {
    if (error instanceof SourceOperationBusyError) throw error
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: 'failed',
      error: error instanceof Error ? error.message : '仓库 Fetch 失败',
    }
  }
}
