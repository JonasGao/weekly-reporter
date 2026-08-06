import { getDb } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'
import { collectSources, rawEvents } from '@/lib/db/schema'
import type { CollectSource, CollectSourceConfig } from '@/lib/db/schema'
import { getAdapter } from './adapters'
import type { FetchCommitsOptions, RawEventData } from './types'
import { basename } from 'path'
import { getNormalizedRepoName } from './adapters/local-git-adapter'
import { normalizeRepoName } from '@/lib/utils'

export interface BranchSyncResult {
  name: string
  status: 'success' | 'failed'
  commitsCount: number
  error?: string
}

export interface SyncResult {
  sourceId: number
  sourceName: string
  status: 'success' | 'failed'
  commitsCount: number
  eventsCount: number
  error?: string
  autoDisabled?: boolean
  /** 部分采集路径失败时的告警信息（整体仍为 success） */
  warnings?: string[]
  /** 各分支同步结果明细（多分支源） */
  branches?: BranchSyncResult[]
}

// 规范化分支配置：兼容旧格式 string[] 和新格式 { name, lastCommitTime }[]
interface BranchConfig {
  name: string
  lastCommitTime: string | null
}

function normalizeBranches(branches: unknown): BranchConfig[] {
  if (!Array.isArray(branches) || branches.length === 0) {
    return [{ name: '', lastCommitTime: null }]
  }
  return branches.map(b => {
    if (typeof b === 'string') {
      return { name: b, lastCommitTime: null }
    }
    if (typeof b === 'object' && b !== null && 'name' in b) {
      return {
        name: (b as BranchConfig).name,
        lastCommitTime: (b as BranchConfig).lastCommitTime || null,
      }
    }
    return { name: '', lastCommitTime: null }
  })
}

function failedResult(source: CollectSource | null, sourceId: number, error: string, autoDisabled?: boolean): SyncResult {
  return {
    sourceId,
    sourceName: source?.name || '',
    status: 'failed',
    commitsCount: 0,
    eventsCount: 0,
    error,
    autoDisabled,
  }
}

/** 构建仓库显示名：本地取远程 URL 归一化（失败则 basename），远程取 owner/repo 归一化 */
async function resolveRepoName(source: CollectSource): Promise<string> {
  if (source.type === 'git-local') {
    return getNormalizedRepoName(source.config.owner)
  }
  if (source.config.repo) {
    return normalizeRepoName(`${source.config.owner}/${source.config.repo}`)
  }
  return basename(source.config.owner)
}

export async function syncSource(sourceId: number, resync?: boolean): Promise<SyncResult> {
  const db = getDb()

  const source = await db.query.collectSources.findFirst({
    where: eq(collectSources.id, sourceId),
  })

  if (!source) {
    return failedResult(null, sourceId, '采集源不存在')
  }

  if (source.status !== 'enabled') {
    return failedResult(source, source.id, source.status === 'disabled' ? '采集源已禁用' : '采集源不可用')
  }

  // 检查邮箱配置：没有邮箱时标记为不可用
  const hasEmails = source.config?.authorEmails && source.config.authorEmails.length > 0
  if (!hasEmails) {
    await db.update(collectSources)
      .set({
        status: 'unavailable',
        updatedAt: new Date(),
      })
      .where(eq(collectSources.id, source.id))

    return failedResult(source, source.id, '未配置邮箱', true)
  }

  const adapter = getAdapter(source.type)
  if (!adapter) {
    return failedResult(source, source.id, '不支持的采集源类型')
  }

  // 迁移旧 paths 模型：有 paths 无 branches 时，从 paths 提取分支名转为 branches
  // config 是 JSON 列，旧数据可能仍有 paths 字段，用 unknown 过渡读取
  const legacyConfig = source.config as CollectSourceConfig & { paths?: Array<{ path: string; lastBranch?: string | null; lastCommitTime?: string | null }> }
  if (source.type === 'git-local' && Array.isArray(legacyConfig.paths) && legacyConfig.paths.length > 0) {
    const branchNames = [...new Set(
      legacyConfig.paths.map(p => p.lastBranch).filter(Boolean) as string[]
    )]
    const { paths: _paths, ...restConfig } = legacyConfig
    const updatedConfig = {
      ...restConfig,
      branches: branchNames.length > 0
        ? branchNames.map(name => ({ name, lastCommitTime: null }))
        : [],
    }
    await db.update(collectSources)
      .set({ config: updatedConfig, updatedAt: new Date() })
      .where(eq(collectSources.id, source.id))
    source.config = updatedConfig
  }

  try {
    const repoName = await resolveRepoName(source)
    const now = new Date()

    // ---- 统一 branches 模型（git-local 与远端类型） ----
    const branches = normalizeBranches(source.config.branches)

    let allCommits: Awaited<ReturnType<typeof adapter.fetchCommits>> = []
    // 记录每个 commit 来自哪个分支（多分支源下归一化时需要区分）
    const branchCommits: Array<{ commit: Awaited<ReturnType<typeof adapter.fetchCommits>>[number]; branchName: string }> = []
    // 记录每个分支本次拉取到的最大 committer date
    const branchMaxCommitterDate: Record<string, Date> = {}
    // 记录每个分支的同步结果
    const branchResults: BranchSyncResult[] = []

    // Sync each branch with per-branch cursor and error handling
    for (const branch of branches) {
      try {
        // 使用分支自己的 cursor，resync 模式下不传 since
        const since = resync ? undefined : (branch.lastCommitTime ? new Date(branch.lastCommitTime) : undefined)

        const options: FetchCommitsOptions = {
          config: {
            ...source.config,
            branch: branch.name || undefined,
          },
          since,
          until: new Date(),
        }

        const commits = await adapter.fetchCommits(options)
        allCommits = allCommits.concat(commits)
        for (const c of commits) {
          branchCommits.push({ commit: c, branchName: branch.name })
        }

        // 计算该分支本次拉取到的最大 committer date
        if (commits.length > 0) {
          const maxDate = commits.reduce((max, c) =>
            c.committerDate > max ? c.committerDate : max,
            commits[0].committerDate
          )
          branchMaxCommitterDate[branch.name] = maxDate
        }

        branchResults.push({
          name: branch.name,
          status: 'success',
          commitsCount: commits.length,
        })
      } catch (branchError) {
        const errorMessage = branchError instanceof Error ? branchError.message : '未知错误'
        branchResults.push({
          name: branch.name,
          status: 'failed',
          commitsCount: 0,
          error: errorMessage,
        })
      }
    }

    // 判断整体状态
    const failedBranches = branchResults.filter(b => b.status === 'failed')
    const allBranchesFailed = failedBranches.length === branchResults.length

    if (allBranchesFailed) {
      // 全部分支失败
      const firstError = failedBranches[0]?.error || '未知错误'
      const errorMessage = `全部分支同步失败：${firstError}`

      await db.update(collectSources)
        .set({
          lastSyncStatus: 'failed',
          updatedAt: now,
        })
        .where(eq(collectSources.id, source.id))

      return failedResult(source, source.id, errorMessage)
    }

    const baseSourceInfo = {
      repo: repoName,
      branch: '',  // will be overridden per commit
      sourceId: source.id,
      sourceName: source.name,
    }

    const events = branchCommits.map(({ commit, branchName }) =>
      adapter.normalizeCommit(commit, source.type, { ...baseSourceInfo, branch: branchName })
    )
    const eventsCount = await insertNewEvents(db, source.id, events, now)

    // 更新分支 cursor：只更新本次拉到新 commit 的分支
    const updatedBranches = branches.map(b => {
      const newCursor = branchMaxCommitterDate[b.name]
      if (newCursor) {
        return { name: b.name, lastCommitTime: newCursor.toISOString() }
      }
      return { name: b.name, lastCommitTime: b.lastCommitTime }
    })

    await db.update(collectSources)
      .set({
        config: { ...source.config, branches: updatedBranches },
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
      eventsCount,
      branches: branchResults,
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

    return failedResult(source, source.id, errorMessage, isUnavailable)
  }
}

/** 按 sourceId + sha 去重后插入事件，返回实际插入数 */
async function insertNewEvents(
  db: ReturnType<typeof getDb>,
  sourceId: number,
  events: RawEventData[],
  now: Date,
): Promise<number> {
  const existingEvents = await db.query.rawEvents.findMany({
    where: sql`json_extract(${rawEvents.metadata}, '$.sourceId') = ${sourceId}`,
  })
  const existingShaSet = new Set(
    existingEvents
      .filter(e => e.metadata?.sha)
      .map(e => e.metadata?.sha)
  )

  // 本次同步内部（跨路径/跨分支）也可能出现同 sha，先去重再比对存量
  const seen = new Set<string>()
  const newEvents = events.filter(e => {
    const sha = e.metadata?.sha
    if (!sha) return true
    if (seen.has(sha) || existingShaSet.has(sha)) return false
    seen.add(sha)
    return true
  })

  if (newEvents.length > 0) {
    await db.insert(rawEvents).values(
      newEvents.map(e => ({
        ...e,
        createdAt: now,
        updatedAt: now,
      }))
    )
  }

  return newEvents.length
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
