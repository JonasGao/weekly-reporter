'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface QuickInputBarProps {
  onSubmit: (data: { content: string }) => Promise<void> | void
  placeholder?: string
}

export function QuickInputBar({
  onSubmit,
  placeholder = '记录工作内容...'
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

    setLoading(true)

    try {
      await onSubmit({ content: trimmedValue })
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
    </div>
  )
}
