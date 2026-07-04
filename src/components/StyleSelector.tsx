'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getStyleLabel } from '@/lib/ai/styles'
import type { AIStyle } from '@/lib/db/schema'

interface StyleSelectorProps {
  value?: AIStyle
  onChange: (style: AIStyle) => void
  templateId?: number
}

const styleOptions: Array<{ value: AIStyle; label: string; description: string }> = [
  {
    value: 'formal',
    label: '正式汇报',
    description: '正式严谨，突出成果价值',
  },
  {
    value: 'technical',
    label: '技术研发',
    description: '专业准确，保留技术细节',
  },
  {
    value: 'concise',
    label: '极简干练',
    description: '短句表达，只保留核心信息',
  },
  {
    value: 'detailed',
    label: '深度复盘',
    description: '侧重问题分析与经验沉淀',
  },
]

export function StyleSelector({ value, onChange, templateId }: StyleSelectorProps) {
  const [templateStyle, setTemplateStyle] = useState<AIStyle | null>(null)
  const [loading, setLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (templateId) {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController()
      
      setLoading(true)
      
      // Debounce the fetch request to avoid rapid consecutive calls
      const timeoutId = setTimeout(() => {
        fetch(`/api/templates/${templateId}`, {
          signal: abortControllerRef.current?.signal,
        })
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch template')
            return res.json()
          })
          .then(data => {
            if (data.template?.aiStyle) {
              setTemplateStyle(data.template.aiStyle as AIStyle)
            }
          })
          .catch(error => {
            // Ignore abort errors
            if (error.name !== 'AbortError') {
              console.error('Failed to fetch template style:', error)
            }
          })
          .finally(() => {
            setLoading(false)
            abortControllerRef.current = null
          })
      }, 300) // 300ms debounce delay

      return () => {
        clearTimeout(timeoutId)
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }
    }
  }, [templateId])

  const currentValue = value || templateStyle || 'formal'
  const currentLabel = getStyleLabel(currentValue)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          AI 风格
        </label>
        <span className="text-xs text-muted-foreground">
          {currentLabel}
        </span>
      </div>
      <Select
        value={currentValue}
        onValueChange={(val) => onChange(val as AIStyle)}
        disabled={loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="选择 AI 风格" />
        </SelectTrigger>
        <SelectContent>
          {styleOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}