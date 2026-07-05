'use client'

import { useState, useEffect } from 'react'
import { QuickInputBar } from '@/components/QuickInputBar'
import { TimelineView } from '@/components/TimelineView'
import { TagFilterPanel } from '@/components/TagFilterPanel'
import type { RawEvent } from '@/lib/db/schema'

interface TagStat {
  name: string
  color: string | null
  usage_count: number
}

export default function TimelinePage() {
  const [events, setEvents] = useState<RawEvent[]>([])
  const [tagStats, setTagStats] = useState<TagStat[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
    loadTagStats()
  }, [selectedTags])

  const loadEvents = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','))
      }
      
      const res = await fetch(`/api/events?${params}`)
      const data = await res.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTagStats = async () => {
    try {
      const res = await fetch('/api/tags/stats')
      const data = await res.json()
      setTagStats(data)
    } catch (error) {
      console.error('Failed to load tag stats:', error)
    }
  }

  const handleSubmit = async ({ content, tags }: { content: string; tags: string[] }) => {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tags }),
    })
    loadEvents()
    loadTagStats()
  }

  const handleEdit = async (id: number, data: Partial<RawEvent>) => {
    await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    loadEvents()
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    loadEvents()
    loadTagStats()
  }

  const handleTagSelect = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleClearFilters = () => {
    setSelectedTags([])
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
            <TimelineView
              events={events}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTagClick={handleTagSelect}
            />
          )}
        </div>
        
        <div>
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