'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (templateId) {
      setLoading(true)
      fetch(`/api/templates/${templateId}`)
        .then(res => res.json())
        .then(data => {
          if (data.template?.aiStyle) {
            setTemplateStyle(data.template.aiStyle as AIStyle)
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
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