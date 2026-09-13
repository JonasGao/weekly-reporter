'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { QuickInputBar } from '@/components/QuickInputBar'
import { TimelineView } from '@/components/TimelineView'
import { SourceFilterPanel, type SourceFilter } from '@/components/SourceFilterPanel'
import { TagFilterPanel } from '@/components/TagFilterPanel'
import { ActivityHeatmap, type HeatmapData } from '@/components/ActivityHeatmap'
import { Button } from '@/components/ui/button'
import { Loader2, Calendar, X } from 'lucide-react'
import type { RawEvent } from '@/lib/db/schema'
import { useSyncAllSources } from '@/components/SyncAllSources'
import { TimelinePlanPanel } from '@/components/TimelinePlanPanel'

export default function TimelinePage() {
  const [events, setEvents] = useState<RawEvent[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([])
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(null)
  const [selectedSources, setSelectedSources] = useState<SourceFilter[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('selectedSources')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('selectedTags')
      try { return saved ? JSON.parse(saved) : [] }
      catch { return [] }
    }
    return []
  })
  const [tagsVersion, setTagsVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState<{ id: number; eventTime: number } | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { completionVersion } = useSyncAllSources()

  const loadEvents = useCallback(async (cursor?: { id: number; eventTime: number }, append = false) => {
    try {
      const params = new URLSearchParams()
      params.set('limit', '30')
      if (selectedSources.length > 0 && selectedSources.length < 2) {
        params.set('source', selectedSources[0])
      }
      // Tag filtering is full-volume — drop the date param when tags are present.
      if (selectedTags.length > 0) {
        params.set('tags', selectedTags.join(','))
      } else if (selectedHeatmapDate) {
        params.set('date', selectedHeatmapDate)
      }
      if (cursor) {
        params.set('cursorId', String(cursor.id))
        params.set('cursorTime', String(cursor.eventTime))
      }

      const res = await fetch(`/api/events?${params}`)
      const data = await res.json()
      const newEvents = data.events || []

      if (append) {
        setEvents(prev => [...prev, ...newEvents])
      } else {
        setEvents(newEvents)
      }
      setNextCursor(data.nextCursor || null)
      setHasMore(data.hasMore ?? false)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [selectedSources, selectedTags, selectedHeatmapDate])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || nextCursor === null) return
    setLoadingMore(true)
    loadEvents(nextCursor, true)
  }, [loadingMore, hasMore, nextCursor, loadEvents])

  // 初始加载 / 筛选变化时重置
  useEffect(() => {
    setLoading(true)
    setEvents([])
    setNextCursor(null)
    setHasMore(true)
    loadEvents()
  }, [selectedSources, selectedTags, selectedHeatmapDate, completionVersion])

  // 滚动到底部自动加载更多
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMore])

  // Load heatmap data (independent of timeline filters)
  useEffect(() => {
    const loadHeatmap = async () => {
      try {
        const res = await fetch('/api/events/heatmap')
        const json = await res.json()
        setHeatmapData(json.data || [])
      } catch (error) {
        console.error('Failed to load heatmap data:', error)
      }
    }
    loadHeatmap()
  }, [completionVersion])

  // 持久化筛选条件到 sessionStorage
  useEffect(() => {
    sessionStorage.setItem('selectedSources', JSON.stringify(selectedSources))
  }, [selectedSources])

  useEffect(() => {
    sessionStorage.setItem('selectedTags', JSON.stringify(selectedTags))
  }, [selectedTags])

  const handleSubmit = async ({ content }: { content: string }) => {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    loadEvents(undefined, false)
    setTagsVersion(v => v + 1)
  }

  const handleEdit = async (id: number, data: Partial<RawEvent>) => {
    await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    loadEvents(undefined, false)
    setTagsVersion(v => v + 1)
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    loadEvents(undefined, false)
  }

  const handleSourceSelect = (source: SourceFilter) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    )
  }

  const handleClearFilters = () => {
    setSelectedSources([])
  }

  const handleTagSelect = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleClearTags = () => {
    setSelectedTags([])
  }

  const handleTagsChanged = () => {
    setTagsVersion(v => v + 1)
    loadEvents(undefined, false)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <QuickInputBar onSubmit={handleSubmit} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : (
            <>
              <TimelineView
                events={events}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              <div ref={sentinelRef} className="flex justify-center py-4">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : hasMore ? (
                  <Button variant="ghost" size="sm" onClick={loadMore}>
                    Load more
                  </Button>
                ) : events.length > 0 ? (
                  <span className="text-xs text-muted-foreground">All loaded</span>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <ActivityHeatmap
            data={heatmapData}
            selectedDate={selectedHeatmapDate}
            onDateSelect={setSelectedHeatmapDate}
          />
          <TimelinePlanPanel refreshKey={completionVersion} />
          {selectedHeatmapDate && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{selectedHeatmapDate}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-auto"
                onClick={() => setSelectedHeatmapDate(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <SourceFilterPanel
            selectedSources={selectedSources}
            onSourceSelect={handleSourceSelect}
            onClearFilters={handleClearFilters}
          />
          <TagFilterPanel
            selectedTags={selectedTags}
            onTagSelect={handleTagSelect}
            onClearTags={handleClearTags}
            onTagsChanged={handleTagsChanged}
            tagsVersion={tagsVersion}
          />
        </div>
      </div>
    </div>
  )
}
