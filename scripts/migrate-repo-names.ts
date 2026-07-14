#!/usr/bin/env tsx
/**
 * 迁移脚本：归一化现有 rawEvents 的 metadata.repo
 *
 * 功能：
 * - 遍历所有 rawEvents
 * - 对 git 来源的事件，归一化 metadata.repo 为 owner/repo 格式
 * - 对本地 git 源，尝试通过 git remote 获取远程地址并归一化
 * - 更新数据库中的事件记录
 *
 * 使用方法：
 *   npx tsx scripts/migrate-repo-names.ts
 */

import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '../src/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { normalizeRepoName } from '../src/lib/utils'
import { execFileSync } from 'child_process'
import { basename } from 'path'
import { DB_PATH } from '../src/lib/paths'

interface RawEventMetadata {
  sha?: string
  url?: string
  repo?: string
  branch?: string
  sourceId?: number
  sourceName?: string
}

/**
 * 尝试获取本地 git 仓库的远程 URL
 */
function getRemoteUrl(repoPath: string): string | null {
  try {
    const stdout = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return stdout.trim() || null
  } catch {
    return null
  }
}

/**
 * 归一化本地 git 仓库的名称
 */
function normalizeLocalRepoName(repoPath: string): string {
  const remoteUrl = getRemoteUrl(repoPath)
  if (remoteUrl) {
    const normalized = normalizeRepoName(remoteUrl)
    if (normalized) {
      return normalized
    }
  }
  // 回退到目录 basename
  return basename(repoPath)
}

async function migrate() {
  console.log('开始迁移 rawEvents 的 metadata.repo...')

  const sqlite = new Database(DB_PATH)
  const db = drizzle(sqlite, { schema })

  // 获取所有事件
  const allEvents = await db.query.rawEvents.findMany()
  console.log(`共找到 ${allEvents.length} 个事件`)

  const gitSources = ['git-local', 'github', 'gitlab']
  let updatedCount = 0
  let skippedCount = 0

  for (const event of allEvents) {
    // 只处理 git 来源的事件
    if (!gitSources.includes(event.source)) {
      skippedCount++
      continue
    }

    const metadata = event.metadata as RawEventMetadata | null
    if (!metadata) {
      skippedCount++
      continue
    }

    let newRepoName: string | null = null

    if (event.source === 'git-local') {
      // 本地 git：尝试从 sourceId 获取仓库路径
      if (metadata.sourceId) {
        const source = await db.query.collectSources.findFirst({
          where: eq(schema.collectSources.id, metadata.sourceId),
        })

        if (source && source.config.owner) {
          newRepoName = normalizeLocalRepoName(source.config.owner)
        }
      }
    } else {
      // 远程 git（GitHub/GitLab）：归一化现有的 repo 名称
      if (metadata.repo) {
        newRepoName = normalizeRepoName(metadata.repo)
      }
    }

    // 如果有新的归一化名称，且和原来不同，则更新
    if (newRepoName && newRepoName !== metadata.repo) {
      console.log(`  更新事件 #${event.id}: "${metadata.repo}" -> "${newRepoName}"`)

      const updatedMetadata: RawEventMetadata = {
        ...metadata,
        repo: newRepoName,
      }

      await db
        .update(schema.rawEvents)
        .set({
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(schema.rawEvents.id, event.id))

      updatedCount++
    } else {
      skippedCount++
    }
  }

  console.log('\n迁移完成！')
  console.log(`  更新：${updatedCount} 个事件`)
  console.log(`  跳过：${skippedCount} 个事件（非 git 源或无需更新）`)

  sqlite.close()
}

migrate()
  .then(() => {
    console.log('迁移成功完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('迁移失败：', error)
    process.exit(1)
  })
