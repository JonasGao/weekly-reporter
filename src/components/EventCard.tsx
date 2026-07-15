'use client'

import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Edit2, Trash2, Star, GitBranch, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RawEvent } from '@/lib/db/schema'

interface EventCardProps {
  event: RawEvent
  onEdit?: (id: number, data: Partial<RawEvent>) => Promise<void>
  onDelete?: (id: number) => Promise<void>
  onTagClick?: (tag: string) => void
}

export function EventCard({ event, onEdit, onDelete, onTagClick }: EventCardProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(event.content)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!onEdit || !editContent.trim()) return
    
    setLoading(true)
    try {
      await onEdit(event.id, { content: editContent.trim() })
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  const renderTime = (eventTime: Date | string | number) => {
    const date = eventTime instanceof Date ? eventTime : new Date(eventTime)
    const msDiff = new Date().getTime() - date.getTime()
    const twoHoursMs = 2 * 60 * 60 * 1000
    if (msDiff <= twoHoursMs) {
      return formatDistanceToNow(date, { addSuffix: true, locale: zhCN })
    }
    return format(date, 'yyyy-MM-dd HH:mm')
  }

  const handleDelete = async () => {
    if (!onDelete) return
    
    if (confirm('确认删除此记录？')) {
      setLoading(true)
      try {
        await onDelete(event.id)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          {event.isImportant && (
            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
          )}
          <div className="flex-1 space-y-2">
            {editing ? (
              <div className="space-y-2">
                <Input
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  disabled={loading}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmit} disabled={loading}>
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={loading}>
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm">{event.content}</p>
            )}
            
            {event.tags && event.tags.length > 0 && (
              <div className="flex gap-1">
                {event.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => onTagClick?.(tag)}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {event.source === 'manual' ? (
                <FileText className="h-3 w-3" />
              ) : (
                <GitBranch className="h-3 w-3" />
              )}
              <span>
                {renderTime(event.eventTime)}
              </span>
              {event.metadata?.repo && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="font-medium text-foreground/70">{event.metadata.repo}</span>
                </>
              )}
              {event.metadata?.branch && (
                <span className="text-muted-foreground/70">⌊{event.metadata.branch}⌋</span>
              )}
              {event.metadata?.sourceName && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{event.metadata.sourceName}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {!editing && event.source === 'manual' && (
          <div className="flex gap-1">
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={loading}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" onClick={handleDelete} disabled={loading}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}