'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, RotateCcw, Trash2, Edit, ChevronLeft, ChevronRight, Search, X, Loader2, CheckCircle2, XCircle, Clock, ToggleLeft, ToggleRight, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'

interface CollectSource {
  id: number
  type: string
  name: string
  projectScope: 'work' | 'personal'
  config: {
    baseUrl?: string
    owner: string
    repo: string
    token: string
    authorEmails: string[]
    branches?: Array<string | { name: string; lastCommitTime?: string | null }>
    aliases?: string[]
  }
  enabled: boolean
  status: 'enabled' | 'disabled' | 'unavailable' | null
  lastSyncAt: string | null
  lastSyncStatus: string | null
  createdAt: string
  updatedAt: string
}

type SortableColumn = 'name' | 'type' | 'projectScope' | 'lastSyncAt' | 'status'

function getSortIcon(col: SortableColumn, sortBy: string, sortOrder: string) {
  if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
  if (sortOrder === 'asc') return <ArrowUp className="h-3 w-3" />
  return <ArrowDown className="h-3 w-3" />
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
  const [sourceStatusFilter, setSourceStatusFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sourceStatusFilter') || ''
    }
    return ''
  })
  const [typeFilter, setTypeFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sourceType') || ''
    }
    return ''
  })
  const [scopeFilter, setScopeFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sourceScope') || ''
    }
    return ''
  })
  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sourceSortBy') || ''
    }
    return ''
  })
  const [sortOrder, setSortOrder] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sourceSortOrder') || 'desc'
    }
    return 'desc'
  })
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set())
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const pageSize = 20

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim()
      setSearchTerm(trimmed)
      sessionStorage.setItem('sourceSearch', trimmed)
      setPage(prev => prev !== 1 ? 1 : prev)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchSources = useCallback(async (targetPage?: number) => {
    const p = targetPage ?? page
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) })
      if (searchTerm) params.set('name', searchTerm)
      if (typeFilter) params.set('type', typeFilter)
      if (syncStatusFilter) params.set('syncStatus', syncStatusFilter)
      if (sourceStatusFilter) params.set('sourceStatus', sourceStatusFilter)
      if (scopeFilter) params.set('projectScope', scopeFilter)
      if (sortBy) {
        params.set('sortBy', sortBy)
        params.set('sortOrder', sortOrder)
      }
      const res = await fetch(`/api/collect/sources?${params}`)

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: '未知错误' }))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setSources(data.sources || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Failed to fetch sources:', error)
      toast.error(error instanceof Error ? error.message : '获取采集源列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm, syncStatusFilter, sourceStatusFilter, typeFilter, scopeFilter, sortBy, sortOrder])

  const fetchSourcesRef = useRef(fetchSources)

  useEffect(() => {
    fetchSourcesRef.current = fetchSources
  })

  const stableFetchSources = useCallback((targetPage?: number) => {
    return fetchSourcesRef.current(targetPage)
  }, [])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  useEffect(() => {
    if (onRefresh) {
      onRefresh(() => {
        setPage(1)
        stableFetchSources(1)
      })
    }
  }, [onRefresh, stableFetchSources])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function getSourceTypeLabel(type: string): string {
    switch (type) {
      case 'git-remote-github':
        return 'GitHub'
      case 'git-remote-gitlab':
        return 'GitLab'
      case 'git-remote-gitee':
        return 'Gitee'
      case 'git-local':
        return '本地'
      default:
        return type
    }
  }

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

  function getBranchNames(branches?: Array<string | { name: string; lastCommitTime?: string | null }>): string[] {
    return branches?.map(b => typeof b === 'string' ? b : b.name).filter(Boolean) || []
  }

  function getSyncCursor(branches?: Array<string | { name: string; lastCommitTime?: string | null }>): string | null {
    const maxCursor = branches?.reduce((max, b) => {
      if (typeof b === 'object' && b.lastCommitTime) {
        const t = new Date(b.lastCommitTime).getTime()
        return t > max ? t : max
      }
      return max
    }, 0)
    if (maxCursor) {
      return new Date(maxCursor).toLocaleString()
    }
    return null
  }

  function truncateList(items: string[], max = 1): { text: string; full: string } {
    if (items.length === 0) return { text: '-', full: '' }
    if (items.length <= max) return { text: items.join(', '), full: items.join(', ') }
    return { text: `${items[0]} +${items.length - 1}`, full: items.join(', ') }
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
      } else if (data.result?.autoDisabled) {
        toast.error('路径不存在，已自动标记为不可用')
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
      } else if (data.result?.autoDisabled) {
        toast.error('路径不存在，已自动标记为不可用')
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

  async function handleToggle(sourceId: number, currentStatus: string) {
    if (currentStatus === 'unavailable') return
    const newStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled'
    setTogglingIds(prev => new Set(prev).add(sourceId))
    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, status: newStatus as any, enabled: newStatus === 'enabled' } : s))
    try {
      const res = await fetch(`/api/collect/sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        setSources(prev => prev.map(s => s.id === sourceId ? { ...s, status: currentStatus as any, enabled: currentStatus === 'enabled' } : s))
        toast.error('更新状态失败')
      }
    } catch {
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, status: currentStatus as any, enabled: currentStatus === 'enabled' } : s))
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

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === sources.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sources.map(s => s.id)))
    }
  }

  async function handleBulkUpdateScope(newScope: 'work' | 'personal') {
    if (selectedIds.size === 0) return

    try {
      setBulkUpdating(true)
      const res = await fetch('/api/collect/sources/bulk-update-scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          projectScope: newScope,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(`成功更新 ${data.updatedCount} 个采集源的项目类型`)
        setSelectedIds(new Set())
        fetchSources()
      } else {
        toast.error(data.error || '更新失败')
      }
    } catch (error) {
      toast.error('更新失败')
    } finally {
      setBulkUpdating(false)
    }
  }

  function handleSort(column: SortableColumn) {
    let newSortBy: string
    let newSortOrder: string
    if (sortBy === column) {
      if (sortOrder === 'asc') {
        newSortBy = column
        newSortOrder = 'desc'
      } else {
        newSortBy = ''
        newSortOrder = 'desc'
      }
    } else {
      newSortBy = column
      newSortOrder = 'asc'
    }
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
    sessionStorage.setItem('sourceSortBy', newSortBy)
    sessionStorage.setItem('sourceSortOrder', newSortOrder)
    setPage(1)
  }

  function SortHeader({ column, label }: { column: SortableColumn; label: string }) {
    return (
      <button
        onClick={() => handleSort(column)}
        className="inline-flex items-center gap-1 hover:text-foreground whitespace-nowrap"
      >
        {label}
        {getSortIcon(column, sortBy, sortOrder)}
      </button>
    )
  }

  if (loading && sources.length === 0) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
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
        <div className="flex items-center gap-1" role="radiogroup" aria-label="类型筛选">
          {[
            { value: '', label: '全部' },
            { value: 'git-remote-github', label: 'GitHub' },
            { value: 'git-remote-gitlab', label: 'GitLab' },
            { value: 'git-remote-gitee', label: 'Gitee' },
            { value: 'git-local', label: '本地' },
          ].map(option => (
            <label
              key={option.value}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                typeFilter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <input
                type="radio"
                name="sourceType"
                value={option.value}
                checked={typeFilter === option.value}
                onChange={e => {
                  const val = e.target.value
                  setTypeFilter(val)
                  sessionStorage.setItem('sourceType', val)
                  setPage(prev => prev !== 1 ? 1 : prev)
                }}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
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
                  setPage(prev => prev !== 1 ? 1 : prev)
                }}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="采集源状态筛选">
          {[
            { value: '', label: '全部' },
            { value: 'enabled', label: '启用' },
            { value: 'disabled', label: '禁用' },
            { value: 'unavailable', label: '不可用' },
          ].map(option => (
            <label
              key={option.value}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                sourceStatusFilter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <input
                type="radio"
                name="sourceStatus"
                value={option.value}
                checked={sourceStatusFilter === option.value}
                onChange={e => {
                  const val = e.target.value
                  setSourceStatusFilter(val)
                  sessionStorage.setItem('sourceStatusFilter', val)
                  setPage(prev => prev !== 1 ? 1 : prev)
                }}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="项目范围筛选">
          {[
            { value: '', label: '全部' },
            { value: 'work', label: '工作' },
            { value: 'personal', label: '个人' },
          ].map(option => (
            <label
              key={option.value}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                scopeFilter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <input
                type="radio"
                name="sourceScope"
                value={option.value}
                checked={scopeFilter === option.value}
                onChange={e => {
                  const val = e.target.value
                  setScopeFilter(val)
                  sessionStorage.setItem('sourceScope', val)
                  setPage(prev => prev !== 1 ? 1 : prev)
                }}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        {(searchTerm || typeFilter || syncStatusFilter || sourceStatusFilter || scopeFilter) && (
          <span className="text-xs text-muted-foreground">
            找到 {total} 个结果
          </span>
        )}
      </div>

      {total === 0 && !loading ? (
        !searchTerm && !typeFilter && !syncStatusFilter && !sourceStatusFilter && !scopeFilter ? (
          <div className="border rounded-lg py-8 text-center">
            <p className="text-muted-foreground mb-4">暂无采集源</p>
            <Link href="/collect/new">
              <Button variant="outline">
                添加采集源
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">
            没有找到
          </div>
        )
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-left w-10">
                  <input
                    type="checkbox"
                    checked={sources.length > 0 && selectedIds.size === sources.length}
                    onChange={toggleSelectAll}
                    className="rounded border-input h-4 w-4"
                  />
                </th>
                <th className="sticky left-10 z-10 bg-muted/30 px-3 py-2.5 text-left min-w-[150px]">
                  <SortHeader column="name" label="名称" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[90px]">
                  <SortHeader column="type" label="类型" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[140px]">仓库</th>
                <th className="px-3 py-2.5 text-left min-w-[120px]">分支</th>
                <th className="px-3 py-2.5 text-left min-w-[100px]">别名</th>
                <th className="px-3 py-2.5 text-left min-w-[150px]">邮箱</th>
                <th className="px-3 py-2.5 text-left min-w-[80px]">
                  <SortHeader column="projectScope" label="项目范围" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[90px]">
                  <SortHeader column="status" label="状态" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[80px]">同步</th>
                <th className="px-3 py-2.5 text-left min-w-[100px]">
                  <SortHeader column="lastSyncAt" label="最近同步" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[140px]">同步至</th>
                <th className="px-3 py-2.5 text-left min-w-[120px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(source => {
                const isSyncing = syncingIds.has(source.id)
                const isToggling = togglingIds.has(source.id)
                const isSelected = selectedIds.has(source.id)
                const sourceStatus = source.status || (source.enabled ? 'enabled' : 'disabled')
                const branchesTrunc = truncateList(getBranchNames(source.config.branches))
                const aliasesTrunc = truncateList(source.config.aliases || [])
                const emailsTrunc = truncateList(source.config.authorEmails || [])
                const syncCursor = getSyncCursor(source.config.branches)
                const hasSyncError = source.lastSyncStatus === 'failure'

                return (
                  <tr
                    key={source.id}
                    className={`border-b hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''} ${hasSyncError ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}
                  >
                    <td className="sticky left-0 z-[5] bg-inherit px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(source.id)}
                        className="rounded border-input h-4 w-4"
                      />
                    </td>
                    <td className="sticky left-10 z-[5] bg-inherit px-3 py-2.5 font-medium truncate max-w-[200px]">
                      {source.name}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {getSourceTypeLabel(source.type)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {source.config.owner}/{source.config.repo}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground" title={branchesTrunc.full}>
                      {branchesTrunc.text}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground" title={aliasesTrunc.full}>
                      {aliasesTrunc.text}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[200px]" title={emailsTrunc.full}>
                      {emailsTrunc.text}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {source.projectScope === 'work' ? '工作项目' : '个人项目'}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => !isToggling && handleToggle(source.id, sourceStatus)}
                        disabled={isToggling || sourceStatus === 'unavailable'}
                        className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full transition-all ${
                          sourceStatus === 'enabled'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 cursor-pointer'
                            : sourceStatus === 'unavailable'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 cursor-not-allowed'
                            : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 cursor-pointer'
                        } ${isToggling ? 'opacity-50 pointer-events-none' : ''}`}
                        title={sourceStatus === 'enabled' ? '点击禁用' : sourceStatus === 'unavailable' ? '路径不可用，需手动恢复' : '点击启用'}
                      >
                        {isToggling ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : sourceStatus === 'enabled' ? (
                          <ToggleRight className="h-3 w-3" />
                        ) : sourceStatus === 'unavailable' ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <ToggleLeft className="h-3 w-3" />
                        )}
                        {sourceStatus === 'enabled' ? '启用' : sourceStatus === 'unavailable' ? '不可用' : '禁用'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {source.lastSyncStatus === 'success' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        ) : source.lastSyncStatus === 'failure' ? (
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                        )}
                        <span className={`text-xs whitespace-nowrap ${
                          source.lastSyncStatus === 'failure' ? 'text-red-600 dark:text-red-400 font-medium' :
                          source.lastSyncStatus === 'success' ? 'text-green-700 dark:text-green-400' : ''
                        }`}>
                          {source.lastSyncAt ? relativeTime(source.lastSyncAt) : '未同步'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {syncCursor || '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2 text-xs"
                          disabled={isSyncing || source.config.authorEmails.length === 0}
                          onClick={() => handleSync(source.id)}
                          title={source.config.authorEmails.length === 0 ? '请先配置邮箱' : '同步'}
                        >
                          {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          title={source.config.authorEmails.length === 0 ? '请先配置邮箱' : '重新同步（拉取全部历史，不重复入库）'}
                          disabled={isSyncing || source.config.authorEmails.length === 0}
                          onClick={() => handleResync(source.id)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Link href={`/collect/${source.id}`}>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(source.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg px-4 py-3 flex items-center gap-4 z-50">
          <span className="text-sm font-medium">
            已选择 {selectedIds.size} 项
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkUpdateScope('work')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              设为工作项目
            </button>
            <button
              onClick={() => handleBulkUpdateScope('personal')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              设为个人项目
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </>
  )
}
