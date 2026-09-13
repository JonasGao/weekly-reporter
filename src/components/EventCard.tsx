'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Edit2, Trash2, FileText, GitBranch } from 'lucide-react'
import type { RawEvent } from '@/lib/db/schema'
import { EventTimestamp } from './EventTimestamp'

interface EventCardProps {
  event: RawEvent
  onEdit?: (id: number, data: Partial<RawEvent>) => Promise<void>
  onDelete?: (id: number) => Promise<void>
}

export function EventCard({ event, onEdit, onDelete }: EventCardProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(event.content)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!onEdit) return

    const trimmed = editContent.trim()
    if (!trimmed) return

    setLoading(true)
    try {
      await onEdit(event.id, { content: trimmed })
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IME composition: let the IME handle any key (Enter confirms candidate, Esc cancels candidate).
    // Must be the FIRST check so Esc/Enter during composition go to the IME, not to save/exit.
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditContent(event.content)
      setEditing(false)
      return
    }
    if (e.key === 'Enter' && !loading) {
      if (e.shiftKey) {
        return // textarea inserts a real \n naturally
      }
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    if (confirm('Delete this record?')) {
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
              <div className="relative space-y-2">
                <Textarea
                  ref={(el) => {
                    if (el) el.focus()
                  }}
                  rows={3}
                  className="resize-none overflow-y-auto field-sizing-fixed"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  disabled={loading}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmit} disabled={loading}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={loading}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-line">{event.content}</p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {event.source === 'manual' ? (
                <FileText className="h-3 w-3" />
              ) : (
                <GitBranch className="h-3 w-3" />
              )}
              <EventTimestamp event={event} />
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
                  <span
                    title={
                      event.metadata?.aliases && event.metadata.aliases.length > 0
                        ? `Aliases: ${event.metadata.aliases.join(', ')}`
                        : undefined
                    }
                  >
                    {event.metadata.sourceName}
                  </span>
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
