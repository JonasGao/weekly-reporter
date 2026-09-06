'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, RotateCcw, Download, Trash2, Edit, ChevronLeft, ChevronRight, Search, X, Loader2, CheckCircle2, XCircle, Clock, ToggleLeft, ToggleRight, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Briefcase, User } from 'lucide-react'
import { toast } from 'sonner'
import { formatSystemDate, formatSystemDateTime, formatSystemRelativeTime } from '@/lib/time-format'

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
  const [fetchingIds, setFetchingIds] = useState<Set<number>>(new Set())
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
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setSources(data.sources || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Failed to fetch sources:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load sources')
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
        return 'Local'
      default:
        return type
    }
  }

  function relativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    if (diff < 30 * 24 * 60 * 60 * 1000) return formatSystemRelativeTime(dateStr)
    return formatSystemDate(dateStr)
  }

  function getBranchNames(config: CollectSource['config']): string[] {
    return config.branches?.map(b => typeof b === 'string' ? b : b.name).filter(Boolean) || []
  }

  function getSyncCursor(config: CollectSource['config']): string | null {
    const maxCursor = config.branches?.reduce((max, b) => {
      if (typeof b === 'object' && b.lastCommitTime) {
        const t = new Date(b.lastCommitTime).getTime()
        return t > max ? t : max
      }
      return max
    }, 0)
    if (maxCursor) {
      return formatSystemDateTime(maxCursor)
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
        toast.success(`${data.result.eventsCount} events synced`)
        if (data.result.warnings?.length) {
          toast.warning(data.result.warnings.join('\n'))
        }
      } else if (data.result?.autoDisabled) {
        toast.error('Path not found; source marked unavailable')
      } else {
        toast.error(data.error || 'Sync failed')
      }

      fetchSources()
    } catch (error) {
      toast.error('Sync failed')
    } finally {
      setSyncingIds(prev => { const n = new Set(prev); n.delete(sourceId); return n })
    }
  }

  async function handleResync(sourceId: number) {
    if (!confirm('Resync will fetch all historical commits without duplicating existing records. Continue?')) return
    setSyncingIds(prev => new Set(prev).add(sourceId))
    try {
      const res = await fetch('/api/collect/git-remote/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, resync: true }),
      })
      const data = await res.json()

      if (data.result?.status === 'success') {
        toast.success(`Resync complete. Added ${data.result.eventsCount} events`)
        if (data.result.warnings?.length) {
          toast.warning(data.result.warnings.join('\n'))
        }
      } else if (data.result?.autoDisabled) {
        toast.error('Path not found; source marked unavailable')
      } else {
        toast.error(data.error || 'Resync failed')
      }

      fetchSources()
    } catch (error) {
      toast.error('Resync failed')
    } finally {
      setSyncingIds(prev => { const n = new Set(prev); n.delete(sourceId); return n })
    }
  }

  async function handleFetch(sourceId: number) {
    setFetchingIds(prev => new Set(prev).add(sourceId))
    try {
      const res = await fetch('/api/collect/git-local/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      })
      const data = await res.json()

      if (res.ok && data.result?.status === 'success') {
        toast.success('Repository fetch complete')
      } else {
        toast.error(data.error || 'Repository fetch failed')
      }
    } catch {
      toast.error('Repository fetch failed')
    } finally {
      setFetchingIds(prev => { const n = new Set(prev); n.delete(sourceId); return n })
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
        toast.error('Failed to update status')
      }
    } catch {
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, status: currentStatus as any, enabled: currentStatus === 'enabled' } : s))
      toast.error('Failed to update status')
    } finally {
      setTogglingIds(prev => { const n = new Set(prev); n.delete(sourceId); return n })
    }
  }

  async function handleDelete(sourceId: number) {
    if (!confirm('Delete this source?')) return

    try {
      const res = await fetch(`/api/collect/sources/${sourceId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (data.success) {
        toast.success('Deleted successfully')
        if (sources.length === 1 && page > 1) {
          setPage(page - 1)
        } else {
          fetchSources()
        }
      } else {
        toast.error(data.error || 'Delete failed')
      }
    } catch (error) {
      toast.error('Delete failed')
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
        toast.success(`Updated project scope for ${data.updatedCount} sources`)
        setSelectedIds(new Set())
        fetchSources()
      } else {
        toast.error(data.error || 'Update failed')
      }
    } catch (error) {
      toast.error('Update failed')
    } finally {
      setBulkUpdating(false)
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete the ${selectedIds.size} selected sources?`)) return

    try {
      setBulkUpdating(true)
      const res = await fetch('/api/collect/sources/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(`Deleted ${data.deletedCount} sources`)
        if (selectedIds.size >= sources.length && page > 1) {
          setSelectedIds(new Set())
          setPage(page - 1)
        } else {
          setSelectedIds(new Set())
          fetchSources()
        }
      } else {
        toast.error(data.error || 'Delete failed')
      }
    } catch {
      toast.error('Delete failed')
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
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name…"
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
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Filter by type">
          {[
            { value: '', label: 'All' },
            { value: 'git-remote-github', label: 'GitHub' },
            { value: 'git-remote-gitlab', label: 'GitLab' },
            { value: 'git-remote-gitee', label: 'Gitee' },
            { value: 'git-local', label: 'Local' },
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
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Filter by sync status">
          {[
            { value: '', label: 'All' },
            { value: 'success', label: 'Success' },
            { value: 'failure', label: 'Failed' },
            { value: 'never', label: 'Never synced' },
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
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Filter by source status">
          {[
            { value: '', label: 'All' },
            { value: 'enabled', label: 'Enabled' },
            { value: 'disabled', label: 'Disabled' },
            { value: 'unavailable', label: 'Unavailable' },
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
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Filter by project scope">
          {[
            { value: '', label: 'All' },
            { value: 'work', label: 'Work' },
            { value: 'personal', label: 'Personal' },
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
            {total} results found
          </span>
        )}
      </div>

      {total === 0 && !loading ? (
        !searchTerm && !typeFilter && !syncStatusFilter && !sourceStatusFilter && !scopeFilter ? (
          <div className="border rounded-lg py-8 text-center">
            <p className="text-muted-foreground mb-4">No sources yet</p>
            <Link href="/collect/new">
              <Button variant="outline">
                Add source
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No results found
          </div>
        )
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="sticky left-0 z-10 bg-muted-30-solid px-3 py-2.5 text-left w-10">
                  <input
                    type="checkbox"
                    checked={sources.length > 0 && selectedIds.size === sources.length}
                    onChange={toggleSelectAll}
                    className="rounded border-input h-4 w-4"
                  />
                </th>
                <th className="sticky left-10 z-10 bg-muted-30-solid px-3 py-2.5 text-left min-w-[150px]">
                  <SortHeader column="name" label="Name" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[90px]">
                  <SortHeader column="type" label="Type" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[140px]">Repository</th>
                <th className="px-3 py-2.5 text-left min-w-[120px]">Branches</th>
                <th className="px-3 py-2.5 text-left min-w-[100px]">Aliases</th>
                <th className="px-3 py-2.5 text-left min-w-[150px]">Emails</th>
                <th className="px-3 py-2.5 text-left min-w-[80px]">
                  <SortHeader column="projectScope" label="Project scope" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[90px]">
                  <SortHeader column="status" label="Status" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[80px]">Sync</th>
                <th className="px-3 py-2.5 text-left min-w-[100px]">
                  <SortHeader column="lastSyncAt" label="Last sync" />
                </th>
                <th className="px-3 py-2.5 text-left min-w-[140px]">Synced through</th>
                <th className="sticky right-0 z-10 border-l bg-muted-30-solid px-3 py-2.5 text-left min-w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(source => {
                const isSyncing = syncingIds.has(source.id)
                const isFetching = fetchingIds.has(source.id)
                const isSourceBusy = isSyncing || isFetching
                const isToggling = togglingIds.has(source.id)
                const isSelected = selectedIds.has(source.id)
                const sourceStatus = source.status || (source.enabled ? 'enabled' : 'disabled')
                const branchesTrunc = truncateList(getBranchNames(source.config))
                const aliasesTrunc = truncateList(source.config.aliases || [])
                const emailsTrunc = truncateList(source.config.authorEmails || [])
                const syncCursor = getSyncCursor(source.config)
                const hasSyncError = source.lastSyncStatus === 'failure'

                return (
                  <tr
                    key={source.id}
                    data-selected={isSelected || undefined}
                    data-error={hasSyncError || undefined}
                    className={`group border-b hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''} ${hasSyncError ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}
                  >
                    <td className="sticky left-0 z-[5] bg-background transition-colors px-3 py-2.5 group-hover:bg-muted-30-solid group-data-[selected]:bg-primary-5-solid group-data-[error]:bg-error-row-solid">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(source.id)}
                        className="rounded border-input h-4 w-4"
                      />
                    </td>
                    <td className="sticky left-10 z-[5] bg-background transition-colors px-3 py-2.5 font-medium truncate max-w-[200px] group-hover:bg-muted-30-solid group-data-[selected]:bg-primary-5-solid group-data-[error]:bg-error-row-solid">
                      {source.name}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {getSourceTypeLabel(source.type)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {source.type === 'git-local'
                        ? source.config.owner
                        : `${source.config.owner}/${source.config.repo}`}
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
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {source.projectScope === 'work' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          <Briefcase className="h-3 w-3" />
                          Work project
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          <User className="h-3 w-3" />
                          Personal project
                        </span>
                      )}
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
                        title={sourceStatus === 'enabled' ? 'Click to disable' : sourceStatus === 'unavailable' ? 'Path unavailable; restore manually' : 'Click to enable'}
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
                        {sourceStatus === 'enabled' ? 'Enabled' : sourceStatus === 'unavailable' ? 'Unavailable' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      {source.lastSyncStatus === 'success' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                      ) : source.lastSyncStatus === 'failure' ? (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs whitespace-nowrap ${
                        source.lastSyncStatus === 'failure' ? 'text-red-600 dark:text-red-400 font-medium' :
                        source.lastSyncStatus === 'success' ? 'text-green-700 dark:text-green-400' : ''
                      }`}>
                        {source.lastSyncAt ? relativeTime(source.lastSyncAt) : 'Never synced'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {syncCursor || '-'}
                    </td>
                    <td className="sticky right-0 z-[5] border-l bg-background transition-colors px-3 py-2.5 group-hover:bg-muted-30-solid group-data-[selected]:bg-primary-5-solid group-data-[error]:bg-error-row-solid">
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2 text-xs"
                          disabled={isSourceBusy || source.config.authorEmails.length === 0}
                          onClick={() => handleSync(source.id)}
                          title={source.config.authorEmails.length === 0 ? 'Configure emails first' : 'Sync'}
                        >
                          {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          title={source.config.authorEmails.length === 0 ? 'Configure emails first' : 'Resync (fetch all history without duplicates)'}
                          disabled={isSourceBusy || source.config.authorEmails.length === 0}
                          onClick={() => handleResync(source.id)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        {source.type === 'git-local' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            title="Manual fetch"
                            aria-label="Manual fetch"
                            disabled={isSourceBusy}
                            onClick={() => handleFetch(source.id)}
                          >
                            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          </Button>
                        )}
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
            {total} total · Page {page} of {totalPages}
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
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkUpdateScope('work')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set as work
            </button>
            <button
              onClick={() => handleBulkUpdateScope('personal')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set as personal
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
