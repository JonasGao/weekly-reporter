'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CollectSourceList } from '@/components/CollectSourceList'
import { ScanReposDialog } from '@/components/ScanReposDialog'
import { SyncResultsCard } from '@/components/SyncResultsCard'
import type { SyncResult } from '@/lib/collect/sync'
import { ArrowLeft, Plus, FolderGit2, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CollectPage() {
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null)
  const refreshFnRef = useRef<(() => void) | null>(null)

  const handleRefreshReady = useCallback((fetchFn: () => void) => {
    refreshFnRef.current = fetchFn
  }, [])

  const handleScanSuccess = () => {
    if (refreshFnRef.current) {
      refreshFnRef.current()
    }
  }

  async function handleSyncAll() {
    if (!confirm('确定要同步所有已启用的采集源吗？')) return
    setSyncingAll(true)
    try {
      const res = await fetch('/api/collect/git-remote/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        throw new Error(`同步失败: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      const results = data.results || []

      // 仅在有新结果时才显示卡片
      if (results.length > 0) {
        setSyncResults(results)
      }

      if (refreshFnRef.current) {
        refreshFnRef.current()
      }
    } catch (error) {
      toast.error('同步失败')
    } finally {
      setSyncingAll(false)
    }
  }
  
  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">采集源管理</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={syncingAll} onClick={handleSyncAll}>
            {syncingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {syncingAll ? '同步中...' : '全部同步'}
          </Button>
          <Button variant="outline" disabled={syncingAll} onClick={() => setScanDialogOpen(true)}>
            <FolderGit2 className="h-4 w-4 mr-2" />
            扫描目录
          </Button>
          <Link href="/collect/new">
            <Button disabled={syncingAll}>
              <Plus className="h-4 w-4 mr-2" />
              新建采集源
            </Button>
          </Link>
        </div>
      </div>

      {syncResults && (
        <SyncResultsCard
          results={syncResults}
          onClose={() => setSyncResults(null)}
        />
      )}

      <CollectSourceList onRefresh={handleRefreshReady} />
      
      <ScanReposDialog
        open={scanDialogOpen}
        onClose={() => setScanDialogOpen(false)}
        onSuccess={handleScanSuccess}
      />
    </main>
  )
}