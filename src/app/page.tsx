'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { QuickInputBar } from '@/components/QuickInputBar'
import { TimelineView } from '@/components/TimelineView'
import { TagFilterPanel } from '@/components/TagFilterPanel'
import { SectionTypeFilterPanel } from '@/components/SectionTypeFilterPanel'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { RawEvent, SectionType } from '@/lib/db/schema'

interface TagStat {
  name: string
  color: string | null
  usage_count: number
}

export default function TimelinePage() {
  const [events, setEvents] = useState<RawEvent[]>([])
  const [tagStats, setTagStats] = useState<TagStat[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<SectionType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState<{ id: number; eventTime: number } | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadEvents = useCallback(async (cursor?: { id: number; eventTime: number }, append = false) => {
    try {
      const params = new URLSearchParams()
      params.set('limit', '30')
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','))
      }
      if (selectedTypes.length > 0) {
        params.append('sectionType', selectedTypes.join(','))
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
  }, [selectedTags])

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
  }, [selectedTags, selectedTypes])

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

  const loadTagStats = async () => {
    try {
      const res = await fetch('/api/tags/stats')
      const data = await res.json()
      setTagStats(data)
    } catch (error) {
      console.error('Failed to load tag stats:', error)
    }
  }

  // 初始加载 tagStats（只一次）
  useEffect(() => {
    loadTagStats()
  }, [])

  const handleSubmit = async ({ content, tags }: { content: string; tags: string[] }) => {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tags }),
    })
    // 新事件插到最前面
    loadEvents(undefined, false)
    loadTagStats()
  }

  const handleEdit = async (id: number, data: Partial<RawEvent>) => {
    await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    loadEvents(undefined, false)
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    loadEvents(undefined, false)
    loadTagStats()
  }

  const handleTagSelect = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleTypeSelect = (type: SectionType) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleClearFilters = () => {
    setSelectedTags([])
    setSelectedTypes([])
  }

  const handleManageTags = () => {
    window.location.href = '/tags'
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <QuickInputBar onSubmit={handleSubmit} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-center py-12">加载中...</div>
          ) : (
            <>
              <TimelineView
                events={events}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTagClick={handleTagSelect}
              />
              <div ref={sentinelRef} className="flex justify-center py-4">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    加载中…
                  </div>
                ) : hasMore ? (
                  <Button variant="ghost" size="sm" onClick={loadMore}>
                    加载更多
                  </Button>
                ) : events.length > 0 ? (
                  <span className="text-xs text-muted-foreground">已加载全部</span>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <SectionTypeFilterPanel
            selectedTypes={selectedTypes}
            onTypeSelect={handleTypeSelect}
            onClearFilters={handleClearFilters}
          />
          <TagFilterPanel
            tags={tagStats}
            selectedTags={selectedTags}
            onTagSelect={handleTagSelect}
            onClearFilters={handleClearFilters}
            onManageTags={handleManageTags}
          />
        </div>
      </div>
    </div>
  )
}
