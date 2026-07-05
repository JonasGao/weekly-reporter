'use client'

import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { TimelineViewSwitcher } from './TimelineViewSwitcher'
import { TimelineGroup } from './TimelineGroup'
import type { RawEvent } from '@/lib/db/schema'

type ViewMode = 'day' | 'week' | 'month'

interface TimelineViewProps {
  events: RawEvent[]
  onEdit?: (id: number, data: Partial<RawEvent>) => Promise<void>
  onDelete?: (id: number) => Promise<void>
  onTagClick?: (tag: string) => void
}

function groupEventsByViewMode(events: RawEvent[], viewMode: ViewMode): Map<string, RawEvent[]> {
  const groups = new Map<string, RawEvent[]>()
  
  events.forEach((event) => {
    let key: string
    
    switch (viewMode) {
      case 'day':
        key = format(event.eventTime, 'yyyy-MM-dd EEEE', { locale: zhCN })
        break
      case 'week':
        const weekStart = startOfWeek(event.eventTime, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(event.eventTime, { weekStartsOn: 1 })
        key = `${format(weekStart, 'yyyy-W', { locale: zhCN })} (${format(weekStart, 'MM-dd')} ~ ${format(weekEnd, 'MM-dd')})`
        break
      case 'month':
        key = format(event.eventTime, 'yyyy年MM月', { locale: zhCN })
        break
      default:
        key = format(event.eventTime, 'yyyy-MM-dd', { locale: zhCN })
    }
    
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(event)
  })
  
  return groups
}

export function TimelineView({ events, onEdit, onDelete, onTagClick }: TimelineViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [groups, setGroups] = useState<Map<string, RawEvent[]>>(new Map())
  
  useEffect(() => {
    const grouped = groupEventsByViewMode(events, viewMode)
    setGroups(grouped)
  }, [events, viewMode])
  
  return (
    <div className="space-y-4">
      <TimelineViewSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
      
      <div className="space-y-6">
        {Array.from(groups.entries()).map(([title, groupEvents]) => (
          <TimelineGroup
            key={title}
            title={title}
            events={groupEvents}
            onEdit={onEdit}
            onDelete={onDelete}
            onTagClick={onTagClick}
          />
        ))}
      </div>
    </div>
  )
}