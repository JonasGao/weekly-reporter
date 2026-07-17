'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { parseTags } from '@/lib/tags/parser'
import { toast } from 'sonner'
import { Edit2, Trash2, FileText, GitBranch } from 'lucide-react'
import type { RawEvent } from '@/lib/db/schema'

interface Tag {
  name: string
  color: string | null
  usage_count: number
}

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

  // Tag completion state
  const [tags, setTags] = useState<Tag[]>([])
  const [showCompletion, setShowCompletion] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const commandRef = useRef<HTMLDivElement>(null)
  const hashPositionRef = useRef<number>(-1)

  // Fetch tags when entering edit mode
  useEffect(() => {
    if (editing) {
      fetch('/api/tags/stats')
        .then(res => res.json())
        .then(data => setTags(data))
        .catch(err => console.error('Failed to fetch tags:', err))
    }
  }, [editing])

  // Check if # is at valid position (start or after whitespace)
  const isValidHashPosition = useCallback((text: string, pos: number): boolean => {
    if (pos === 0) return true
    const charBefore = text[pos - 1]
    return /\s/.test(charBefore)
  }, [])

  // Find the # token being typed
  const findCurrentHashToken = useCallback((text: string, cursorPos: number) => {
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '#' && isValidHashPosition(text, i)) {
        const between = text.slice(i + 1, cursorPos)
        if (!/\s/.test(between)) {
          return { hashIndex: i, filterText: between }
        }
      }
      if (/\s/.test(text[i]) && i < cursorPos - 1) {
        break
      }
    }
    return null
  }, [isValidHashPosition])

  // Calculate cursor position for dropdown
  const updateCursorPosition = useCallback((textBeforeCursor: string) => {
    if (!measureRef.current || !inputRef.current) return

    const measure = measureRef.current
    const input = inputRef.current
    const computedStyle = window.getComputedStyle(input)

    measure.style.font = computedStyle.font
    measure.style.padding = computedStyle.padding
    measure.style.border = computedStyle.border
    measure.style.whiteSpace = 'pre'

    measure.textContent = textBeforeCursor
    const inputRect = input.getBoundingClientRect()
    const measureWidth = measure.offsetWidth

    const paddingLeft = parseFloat(computedStyle.paddingLeft)
    const inputHeight = inputRect.height

    setCursorPosition({
      top: inputHeight + 4,
      left: Math.min(paddingLeft + measureWidth, inputRect.width - 200)
    })
  }, [])

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0

    setEditContent(newValue)

    const token = findCurrentHashToken(newValue, cursorPos)
    if (token) {
      hashPositionRef.current = token.hashIndex
      setFilterText(token.filterText)
      setShowCompletion(true)

      const textBeforeCursor = newValue.slice(0, cursorPos)
      updateCursorPosition(textBeforeCursor)
    } else {
      setShowCompletion(false)
      hashPositionRef.current = -1
    }
  }

  const handleSelectTag = async (tagName: string, isCreate: boolean = false) => {
    if (!inputRef.current) return

    if (isCreate) {
      try {
        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tagName, sectionType: 'routine' })
        })
        setTags(prev => [...prev, { name: tagName, color: null, usage_count: 0 }])
      } catch (err) {
        console.error('Failed to create tag:', err)
        toast.error('创建标签失败')
        return
      }
    }

    const input = inputRef.current
    const cursorPos = input.selectionStart || 0
    const hashIndex = hashPositionRef.current

    if (hashIndex >= 0) {
      const before = editContent.slice(0, hashIndex)
      const after = editContent.slice(cursorPos)
      const newValue = before + '#' + tagName + ' ' + after

      setEditContent(newValue)
      setShowCompletion(false)
      setFilterText('')
      hashPositionRef.current = -1

      const newCursorPos = before.length + tagName.length + 2
      setTimeout(() => {
        input.setSelectionRange(newCursorPos, newCursorPos)
        input.focus()
      }, 0)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showCompletion && commandRef.current) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowCompletion(false)
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const commandList = commandRef.current.querySelector('[cmdk-list]')
        if (commandList) {
          const event = new KeyboardEvent('keydown', {
            key: e.key,
            bubbles: true,
            cancelable: true
          })
          commandList.dispatchEvent(event)
        }
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const selectedItem = commandRef.current.querySelector('[data-selected="true"]')
        if (selectedItem) {
          const value = selectedItem.getAttribute('data-value')
          if (value) {
            if (value.startsWith('__create_')) {
              handleSelectTag(filterText, true)
            } else {
              handleSelectTag(value, false)
            }
          }
        } else if (filteredTags.length > 0) {
          handleSelectTag(filteredTags[0].name, false)
        } else {
          handleSubmit()
        }
        return
      }
    }

    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleEditBlur = () => {
    setTimeout(() => {
      setShowCompletion(false)
    }, 200)
  }

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().startsWith(filterText.toLowerCase())
  )

  const shouldShowCreate = filterText.trim() &&
    !tags.some(tag => tag.name.toLowerCase() === filterText.toLowerCase())

  const handleSubmit = async () => {
    if (!onEdit) return

    const trimmed = editContent.trim()
    if (!trimmed) return

    const { content, tags: parsedTags } = parseTags(trimmed)
    if (!content) return

    setLoading(true)
    try {
      await onEdit(event.id, { content, tags: parsedTags })
      setEditing(false)
      setShowCompletion(false)
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
              <div className="relative space-y-2">
                <span
                  ref={measureRef}
                  className="absolute top-0 left-0 invisible whitespace-pre text-sm"
                  aria-hidden="true"
                />
                <Input
                  ref={inputRef}
                  value={editContent}
                  onChange={handleEditChange}
                  onKeyDown={handleEditKeyDown}
                  onBlur={handleEditBlur}
                  disabled={loading}
                />
                {showCompletion && (
                  <div
                    ref={commandRef}
                    className="absolute z-50"
                    style={{
                      top: `${cursorPosition.top}px`,
                      left: `${cursorPosition.left}px`,
                    }}
                  >
                    <Command className="w-64 rounded-lg border shadow-md bg-popover">
                      <CommandList className="max-h-64">
                        <CommandGroup>
                          {filteredTags.slice(0, 8).map(tag => (
                            <CommandItem
                              key={tag.name}
                              value={tag.name}
                              onClick={() => handleSelectTag(tag.name)}
                              className="flex items-center gap-2"
                            >
                              {tag.color && (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: tag.color }}
                                />
                              )}
                              <span>{tag.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {tag.usage_count}
                              </span>
                            </CommandItem>
                          ))}
                          {shouldShowCreate && (
                            <CommandItem
                              value={`__create_${filterText}`}
                              onClick={() => handleSelectTag(filterText, true)}
                              className="text-primary"
                            >
                              <span>+ 创建 &quot;{filterText}&quot;</span>
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                )}
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
                  <span
                    title={
                      event.metadata?.aliases && event.metadata.aliases.length > 0
                        ? `别名: ${event.metadata.aliases.join(', ')}`
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
