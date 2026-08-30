'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { SyncResult } from '@/lib/collect/sync'
import { Button } from '@/components/ui/button'

interface SyncAllSourcesContextValue {
  isSyncing: boolean
  completionVersion: number
  runSyncAll: () => Promise<SyncResult[]>
}

const SyncAllSourcesContext = createContext<SyncAllSourcesContextValue | null>(null)

export function SyncAllSourcesProvider({ children }: { children: ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [completionVersion, setCompletionVersion] = useState(0)
  const activeRequestRef = useRef<Promise<SyncResult[]> | null>(null)

  const runSyncAll = useCallback(() => {
    if (activeRequestRef.current) return activeRequestRef.current

    setIsSyncing(true)
    const request = fetch('/api/collect/git-remote/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          error?: string
          results?: unknown
        }
        if (!Array.isArray(data.results)) {
          throw new Error(
            !response.ok
              ? data.error || `同步失败: ${response.status} ${response.statusText}`
              : '同步响应格式无效',
          )
        }
        const results = data.results as SyncResult[]
        if (!response.ok && results.length === 0) {
          throw new Error(
            data.error || `同步失败: ${response.status} ${response.statusText}`,
          )
        }
        setCompletionVersion((version) => version + 1)
        return results
      })
      .finally(() => {
        activeRequestRef.current = null
        setIsSyncing(false)
      })

    activeRequestRef.current = request
    return request
  }, [])

  const value = useMemo(
    () => ({ isSyncing, completionVersion, runSyncAll }),
    [completionVersion, isSyncing, runSyncAll],
  )

  return (
    <SyncAllSourcesContext.Provider value={value}>
      {children}
    </SyncAllSourcesContext.Provider>
  )
}

export function useSyncAllSources() {
  const context = useContext(SyncAllSourcesContext)
  if (!context) {
    throw new Error('useSyncAllSources must be used within SyncAllSourcesProvider')
  }
  return context
}

export function SyncAllSourcesButton() {
  const router = useRouter()
  const { isSyncing, runSyncAll } = useSyncAllSources()

  async function handleSync() {
    try {
      const results = await runSyncAll()
      if (results.length === 0) {
        toast.info('没有符合条件的采集源可同步')
        return
      }
      const failedSources = results.filter((result) => result.status === 'failed')
      const failedBranches = results.flatMap((result) =>
        (result.branches ?? [])
          .filter((branch) => branch.status === 'failed')
          .map((branch) => ({ sourceName: result.sourceName, branch })),
      )
      if (failedSources.length > 0) {
        const firstFailure = failedSources[0]
        const branchFailureSuffix = failedBranches.length > 0
          ? `，另有 ${failedBranches.length} 个分支失败`
          : ''
        toast.error(
          `同步完成：成功 ${results.length - failedSources.length} 个，失败 ${failedSources.length} 个${branchFailureSuffix}`,
          {
            description: `${firstFailure.sourceName}：${firstFailure.error ?? '同步失败'}`,
            action: {
              label: '查看详情',
              onClick: () => router.push('/collect'),
            },
          },
        )
        return
      }
      if (failedBranches.length > 0) {
        const firstFailure = failedBranches[0]
        toast.warning(`同步完成，但有 ${failedBranches.length} 个分支失败`, {
          description: `${firstFailure.sourceName} / ${firstFailure.branch.name}：${firstFailure.branch.error ?? '同步失败'}`,
          action: {
            label: '查看详情',
            onClick: () => router.push('/collect'),
          },
        })
        return
      }
      const eventsCount = results.reduce((total, result) => total + result.eventsCount, 0)
      toast.success(`同步完成：成功 ${results.length} 个，新增 ${eventsCount} 条事件`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '同步失败')
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={isSyncing}
      aria-label="同步全部采集源"
      title="同步全部采集源"
      onClick={handleSync}
    >
      {isSyncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
    </Button>
  )
}

export function CollectPageSyncButton({
  onStart,
  onResults,
}: {
  onStart?: () => void
  onResults: (results: SyncResult[]) => void
}) {
  const { isSyncing, runSyncAll } = useSyncAllSources()

  async function handleSync() {
    if (!window.confirm('确定要同步所有已启用的采集源吗？')) return

    onStart?.()
    try {
      const results = await runSyncAll()
      if (results.length > 0) onResults(results)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '同步失败')
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isSyncing}
      onClick={handleSync}
    >
      {isSyncing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      {isSyncing ? '同步中...' : '全部同步'}
    </Button>
  )
}
