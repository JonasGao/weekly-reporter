'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { EventCard } from './EventCard'
import type { RawEvent } from '@/lib/db/schema'

interface TimelineGroupProps {
  title: string
  events: RawEvent[]
  onEdit?: (id: number, data: Partial<RawEvent>) => Promise<void>
  onDelete?: (id: number) => Promise<void>
  onTagClick?: (tag: string) => void
}

export function TimelineGroup({ title, events, onEdit, onDelete, onTagClick }: TimelineGroupProps) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">{title}</h3>
      <div className="space-y-2">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onEdit={onEdit}
            onDelete={onDelete}
            onTagClick={onTagClick}
          />
        ))}
      </div>
    </div>
  )
}