'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { parseTags } from '@/lib/tags/parser'
import { toast } from 'sonner'

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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [loading])

  const handleSubmit = async () => {
    const trimmedValue = value.trim()
    
    if (!trimmedValue) {
      return
    }

    const { content, tags } = parseTags(trimmedValue)
    
    if (!content) {
      return
    }

    setLoading(true)
    
    try {
      await onSubmit({ content, tags })
      setValue('')
      toast.success('已记录')
    } catch (error) {
      console.error('Failed to submit:', error)
      toast.error('提交失败')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const renderHighlightedValue = () => {
    const parts: Array<{ text: string; isTag: boolean }> = []
    const regex = /#([\w\u4e00-\u9fa5]+)/g
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

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
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
    </div>
  )
}