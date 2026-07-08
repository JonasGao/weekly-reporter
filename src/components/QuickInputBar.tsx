'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { parseTags } from '@/lib/tags/parser'
import { toast } from 'sonner'

interface Tag {
  name: string
  color: string | null
  usage_count: number
  isCreate?: boolean
}

interface QuickInputBarProps {
  onSubmit: (data: { content: string; tags: string[] }) => Promise<void> | void
  placeholder?: string
}

export function QuickInputBar({
  onSubmit,
  placeholder = '记录工作内容，使用 #标签 分类...'
}: QuickInputBarProps) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [showCompletion, setShowCompletion] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const commandRef = useRef<HTMLDivElement>(null)
  const hashPositionRef = useRef<number>(-1)

  // Fetch tags on mount
  useEffect(() => {
    fetch('/api/tags/stats')
      .then(res => res.json())
      .then(data => setTags(data))
      .catch(err => console.error('Failed to fetch tags:', err))
  }, [])

  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [loading])

  // Check if # is at valid position (start or after whitespace)
  const isValidHashPosition = useCallback((text: string, pos: number): boolean => {
    if (pos === 0) return true
    const charBefore = text[pos - 1]
    return /\s/.test(charBefore)
  }, [])

  // Find the # token being typed
  const findCurrentHashToken = useCallback((text: string, cursorPos: number) => {
    // Find the last # before cursor that's at a valid position
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '#' && isValidHashPosition(text, i)) {
        // Check if there's any space between # and cursor
        const between = text.slice(i + 1, cursorPos)
        if (!/\s/.test(between)) {
          return { hashIndex: i, filterText: between }
        }
      }
      // Stop if we hit whitespace (means this # is not connected to cursor)
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

    // Copy input styles to measure span
    measure.style.font = computedStyle.font
    measure.style.padding = computedStyle.padding
    measure.style.border = computedStyle.border
    measure.style.whiteSpace = 'pre'

    measure.textContent = textBeforeCursor
    const inputRect = input.getBoundingClientRect()
    const measureWidth = measure.offsetWidth

    // Calculate position relative to input
    const paddingLeft = parseFloat(computedStyle.paddingLeft)
    const inputHeight = inputRect.height

    setCursorPosition({
      top: inputHeight + 4, // 4px below input
      left: Math.min(paddingLeft + measureWidth, inputRect.width - 200)
    })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0

    setValue(newValue)

    // Check for # trigger
    const token = findCurrentHashToken(newValue, cursorPos)
    if (token) {
      hashPositionRef.current = token.hashIndex
      setFilterText(token.filterText)
      setShowCompletion(true)
      setSelectedIndex(0) // Reset selection when filter changes

      // Calculate cursor position for dropdown
      const textBeforeCursor = newValue.slice(0, cursorPos)
      updateCursorPosition(textBeforeCursor)
    } else {
      setShowCompletion(false)
      hashPositionRef.current = -1
    }
  }

  const handleSelectTag = async (tagName: string, isCreate: boolean = false) => {
    if (!inputRef.current) return

    // Create new tag if needed
    if (isCreate) {
      try {
        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tagName, sectionType: 'routine' })
        })
        // Update local tags list
        setTags(prev => [...prev, { name: tagName, color: null, usage_count: 0 }])
      } catch (err) {
        console.error('Failed to create tag:', err)
        toast.error('创建标签失败')
        return
      }
    }

    // Replace #token with selected tag + space
    const input = inputRef.current
    const cursorPos = input.selectionStart || 0
    const hashIndex = hashPositionRef.current

    if (hashIndex >= 0) {
      const before = value.slice(0, hashIndex)
      const after = value.slice(cursorPos)
      const newValue = before + '#' + tagName + ' ' + after

      setValue(newValue)
      setShowCompletion(false)
      setFilterText('')
      hashPositionRef.current = -1

      // Set cursor position after the inserted tag
      const newCursorPos = before.length + tagName.length + 2 // #tag + space
      setTimeout(() => {
        input.setSelectionRange(newCursorPos, newCursorPos)
        input.focus()
      }, 0)
    }
  }

  const handleSubmit = async () => {
    const trimmedValue = value.trim()

    if (!trimmedValue) {
      return
    }

    const { content, tags: parsedTags } = parseTags(trimmedValue)

    if (!content) {
      return
    }

    setLoading(true)

    try {
      await onSubmit({ content, tags: parsedTags })
      setValue('')
      setShowCompletion(false)
      toast.success('已记录')
    } catch (error) {
      console.error('Failed to submit:', error)
      toast.error('提交失败')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If completion is showing, handle navigation
    if (showCompletion) {
      const allItems = [...filteredTags.slice(0, 8)]
      if (shouldShowCreate) {
        allItems.push({ name: filterText, color: null, usage_count: 0, isCreate: true })
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setShowCompletion(false)
        setSelectedIndex(0)
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % allItems.length)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length)
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (allItems.length > 0 && selectedIndex < allItems.length) {
          const selectedItem = allItems[selectedIndex]
          if (selectedItem.isCreate) {
            handleSelectTag(filterText, true)
          } else {
            handleSelectTag(selectedItem.name, false)
          }
        } else {
          // No items, submit
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

  const handleBlur = () => {
    // Delay hiding to allow click on dropdown
    setTimeout(() => {
      setShowCompletion(false)
    }, 200)
  }

  const renderHighlightedValue = () => {
    const parts: Array<{ text: string; isTag: boolean }> = []
    const regex = /#([\w一-龥]+)/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: value.slice(lastIndex, match.index), isTag: false })
      }
      parts.push({ text: match[0], isTag: true })
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < value.length) {
      parts.push({ text: value.slice(lastIndex), isTag: false })
    }

    return parts.length > 0 ? parts : [{ text: value, isTag: false }]
  }

  // Filter tags by prefix
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().startsWith(filterText.toLowerCase())
  )

  // Check if should show "create" option
  const shouldShowCreate = filterText.trim() &&
    !tags.some(tag => tag.name.toLowerCase() === filterText.toLowerCase())

  return (
    <div className="relative">
      {/* Hidden span for measuring text position */}
      <span
        ref={measureRef}
        className="absolute top-0 left-0 invisible whitespace-pre text-sm"
        aria-hidden="true"
      />

      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={loading}
        className="w-full"
      />
      {value && (
        <div className="absolute inset-0 flex items-center pointer-events-none px-2.5 overflow-hidden">
          {renderHighlightedValue().map((part, index) => (
            <span
              key={index}
              className={part.isTag ? 'bg-blue-100 px-1 rounded text-sm' : 'text-sm'}
            >
              {part.text}
            </span>
          ))}
        </div>
      )}

      {/* Tag completion dropdown */}
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
                {filteredTags.slice(0, 8).map((tag, index) => (
                  <CommandItem
                    key={tag.name}
                    value={tag.name}
                    data-selected={index === selectedIndex ? 'true' : undefined}
                    onMouseEnter={() => setSelectedIndex(index)}
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
                    data-selected={filteredTags.length === selectedIndex ? 'true' : undefined}
                    onMouseEnter={() => setSelectedIndex(filteredTags.length)}
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
    </div>
  )
}
