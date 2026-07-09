'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, Trash2, Edit, Plus, ChevronLeft, ChevronRight, Search, X, Loader2, CheckCircle2, XCircle, Clock, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'

interface CollectSource {
  id: number
  type: string
  name: string
  config: {
    baseUrl?: string
    owner: string
    repo: string
    token: string
    authorEmails: string[]
    branch?: string
  }
  enabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: string | null
  createdAt: string
  updatedAt: string
}

export function CollectSourceList({ onRefresh }: { onRefresh?: (fetchFn: () => void) => void }) {
  const [sources, setSources] = useState<CollectSource[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sourceSearch') || ''
    }
    return ''
  })
  const [searchTerm, setSearchTerm] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sourceSearch') || ''
    }
    return ''
  })
  const [syncStatusFilter, setSyncStatusFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sourceSyncStatus') || ''
    }
    return ''
  })
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set())
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set())
  const pageSize = 12

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim()
      setSearchTerm(trimmed)
      sessionStorage.setItem('sourceSearch', trimmed)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    fetchSources()
    if (onRefresh) {
      onRefresh(() => {
        setPage(1)
        fetchSources(1)
      })
    }
  }, [onRefresh])

  useEffect(() => {
    if (!loading) fetchSources()
  }, [page, searchTerm, syncStatusFilter])

  async function fetchSources(targetPage?: number) {
    const p = targetPage ?? page
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) })
      if (searchTerm) params.set('name', searchTerm)
      if (syncStatusFilter) params.set('syncStatus', syncStatusFilter)
      const res = await fetch(`/api/collect/sources?${params}`)
      const data = await res.json()
      setSources(data.sources || [])
      setTotal(data.total || 0)
    } catch (error) {
      toast.error('获取采集源列表失败')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function relativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}天前`
    return new Date(dateStr).toLocaleDateString()
  }

  async function handleSync(sourceId: number) {
    setSyncingIds(prev => new Set(prev).add(sourceId))
    try {
      const res = await fetch('/api/collect/git-remote/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      })
      const data = await res.json()

      if (data.result?.status === 'success') {
        toast.success(`${data.result.eventsCount} 条事件已同步`)
      } else {
        toast.error(data.error || '同步失败')
      }

      fetchSources()
    } catch (error) {
      toast.error('同步失败')
    } finally {
      setSyncingIds(prev => { const n = new Set(prev); n.delete(sourceId); return n })
    }
  }

  async function handleResync(sourceId: number) {
    if (!confirm('重新同步将拉取全部历史 commit（已存在的不会重复入库），确定继续？')) return
    setSyncingIds(prev => new Set(prev).add(sourceId))
    try {
      const res = await fetch('/api/collect/git-remote/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, resync: true }),
      })
      const data = await res.json()

      if (data.result?.status === 'success') {
        toast.success(`重新同步完成，新增 ${data.result.eventsCount} 条事件`)
      } else {
        toast.error(data.error || '重新同步失败')
      }

      fetchSources()
    } catch (error) {
      toast.error('重新同步失败')
    } finally {
      setSyncingIds(prev => { const n = new Set(prev); n.delete(sourceId); return n })
    }
  }

  async function handleToggle(sourceId: number, currentEnabled: boolean) {
    setTogglingIds(prev => new Set(prev).add(sourceId))
    // 乐观更新
    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, enabled: !currentEnabled } : s))
    try {
      const res = await fetch(`/api/collect/sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })
      if (!res.ok) {
        // 回滚
        setSources(prev => prev.map(s => s.id === sourceId ? { ...s, enabled: currentEnabled } : s))
        toast.error('更新状态失败')
      }
    } catch {
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, enabled: currentEnabled } : s))
      toast.error('更新状态失败')
    } finally {
      setTogglingIds(prev => { const n = new Set(prev); n.delete(sourceId); return n })
    }
  }

  async function handleDelete(sourceId: number) {
    if (!confirm('确定要删除此采集源吗？')) return

    try {
      const res = await fetch(`/api/collect/sources/${sourceId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (data.success) {
        toast.success('删除成功')
        // 如果当前页删完了且不是第一页，回退一页
        if (sources.length === 1 && page > 1) {
          setPage(page - 1)
        } else {
          fetchSources()
        }
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  if (loading && sources.length === 0) {
    return <div className="text-center py-8">加载中...</div>
  }

  if (total === 0 && !loading && !searchTerm) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">暂无采集源</p>
          <Link href="/collect/new">
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              添加采集源
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="搜索名称…"
            className="h-8 pl-8 text-sm"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearchTerm('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="同步状态筛选">
          {[
            { value: '', label: '全部' },
            { value: 'success', label: '成功' },
            { value: 'failure', label: '失败' },
            { value: 'never', label: '未同步' },
          ].map(option => (
            <label
              key={option.value}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                syncStatusFilter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <input
                type="radio"
                name="syncStatus"
                value={option.value}
                checked={syncStatusFilter === option.value}
                onChange={e => {
                  const val = e.target.value
                  setSyncStatusFilter(val)
                  sessionStorage.setItem('sourceSyncStatus', val)
                  setPage(1)
                }}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        {(searchTerm || syncStatusFilter) && (
          <span className="text-xs text-muted-foreground">
            找到 {total} 个结果
          </span>
        )}
      </div>

      {total === 0 && !loading && searchTerm ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          未找到匹配「{searchTerm}」的采集源
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sources.map(source => {
            const isSyncing = syncingIds.has(source.id)
            const isToggling = togglingIds.has(source.id)
            return (
            <Card key={source.id} size="sm" className={`flex flex-col ${source.lastSyncStatus === 'failure' ? 'ring-1 ring-red-300 dark:ring-red-800' : ''}`}>
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between gap-1">
                  <CardTitle className="text-sm truncate">{source.name}</CardTitle>
                  <button
                    onClick={() => !isToggling && handleToggle(source.id, source.enabled)}
                    disabled={isToggling}
                    className={`shrink-0 inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full cursor-pointer transition-all ${
                      source.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                        : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                    } ${isToggling ? 'opacity-50 pointer-events-none' : ''}`}
                    title={source.enabled ? '点击禁用' : '点击启用'}
                  >
                    {isToggling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : source.enabled ? (
                      <ToggleRight className="h-3 w-3" />
                    ) : (
                      <ToggleLeft className="h-3 w-3" />
                    )}
                    {source.enabled ? '启用' : '禁用'}
                  </button>
                </div>
                <CardDescription className="text-xs truncate">
                  {source.config.owner}/{source.config.repo}
                  {source.config.branch && ` (${source.config.branch})`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="truncate">邮箱: {source.config.authorEmails.join(', ') || '-'}</p>
                  <div className="flex items-center gap-1.5">
                    {source.lastSyncStatus === 'success' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    ) : source.lastSyncStatus === 'failure' ? (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className={
                      source.lastSyncStatus === 'failure' ? 'text-red-600 dark:text-red-400 font-medium' :
                      source.lastSyncStatus === 'success' ? 'text-green-700 dark:text-green-400' : ''
                    }>
                      {source.lastSyncAt ? relativeTime(source.lastSyncAt) : '未同步'}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="gap-1 pt-2 mt-auto">
                <div className="flex items-center gap-0.5">
                  <Button size="sm" variant="default" className="h-7 px-2 text-xs" disabled={isSyncing} onClick={() => handleSync(source.id)}>
                    {isSyncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    {isSyncing ? '同步中' : '同步'}
                  </Button>
                  <button
                    title="重新同步（拉取全部历史，不重复入库）"
                    className="h-7 w-5 inline-flex items-center justify-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    disabled={isSyncing}
                    onClick={() => handleResync(source.id)}
                  >
                    ↻
                  </button>
                </div>
                <Link href={`/collect/${source.id}`} className="flex-1">
                  <Button size="sm" variant="outline" className="h-7 w-full px-2 text-xs">
                    <Edit className="h-3 w-3 mr-1" />
                    编辑
                  </Button>
                </Link>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(source.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-xs text-muted-foreground">
            共 {total} 个，第 {page}/{totalPages} 页
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e${i}`} className="px-2 text-xs text-muted-foreground leading-7">…</span>
                ) : (
                  <Button
                    key={p}
                    size="sm"
                    variant={p === page ? 'default' : 'outline'}
                    className="h-7 w-7 p-0 text-xs"
                    onClick={() => setPage(Number(p))}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}