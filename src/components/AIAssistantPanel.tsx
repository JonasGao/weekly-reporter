'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Expand, Palette } from 'lucide-react'
import { toast } from 'sonner'
import type { AIStyle } from '@/lib/db/schema'

interface AIAssistantPanelProps {
  reportId: number
  templateId?: number
  styleOverride?: AIStyle
}

export function AIAssistantPanel({ reportId, templateId, styleOverride }: AIAssistantPanelProps) {
  const [selectedEvent, setSelectedEvent] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const handlePolish = async () => {
    if (!selectedEvent.trim()) {
      toast.error('请选择或输入要润色的事件')
      return
    }

    setLoading('polish')
    try {
      const response = await fetch('/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventContent: selectedEvent,
          templateId,
          styleOverride,
        }),
      })

      if (!response.ok) throw new Error('润色失败')

      const data = await response.json()
      toast.success('润色成功')
      // TODO: Insert polished content into editor
      console.log('Polished content:', data.polishedContent)
    } catch (error) {
      toast.error('润色失败，请重试')
      console.error(error)
    } finally {
      setLoading(null)
    }
  }

  const handleExpand = async () => {
    if (!selectedEvent.trim()) {
      toast.error('请选择或输入要扩展的事件')
      return
    }

    setLoading('expand')
    try {
      const response = await fetch('/api/ai/expand-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selectedEvent,
          templateId,
          styleOverride,
        }),
      })

      if (!response.ok) throw new Error('扩展失败')

      const data = await response.json()
      toast.success('扩展成功')
      // TODO: Insert expanded content into editor
      console.log('Expanded content:', data.expandedContent)
    } catch (error) {
      toast.error('扩展失败，请重试')
      console.error(error)
    } finally {
      setLoading(null)
    }
  }

  const handleUnify = async () => {
    setLoading('unify')
    try {
      const response = await fetch('/api/ai/unify-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          templateId,
          styleOverride,
        }),
      })

      if (!response.ok) throw new Error('统一风格失败')

      const data = await response.json()
      toast.success('风格统一成功')
      // TODO: Update editor with unified content
      console.log('Unified content:', data.unifiedContent)
    } catch (error) {
      toast.error('统一风格失败，请重试')
      console.error(error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          选择事件
        </label>
        <textarea
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          placeholder="在编辑器中选择文本，或在此输入要处理的周报内容..."
          className="w-full min-h-[120px] px-3 py-2 text-sm border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          AI 助手操作
        </label>
        <div className="grid grid-cols-1 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePolish}
            disabled={loading !== null}
            className="justify-start h-auto py-2.5"
          >
            <Sparkles className="h-4 w-4 mr-2 flex-shrink-0" />
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">润色文本</span>
              <span className="text-xs text-muted-foreground">
                优化表达，提升专业度
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExpand}
            disabled={loading !== null}
            className="justify-start h-auto py-2.5"
          >
            <Expand className="h-4 w-4 mr-2 flex-shrink-0" />
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">扩展内容</span>
              <span className="text-xs text-muted-foreground">
                补充细节，丰富描述
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleUnify}
            disabled={loading !== null}
            className="justify-start h-auto py-2.5"
          >
            <Palette className="h-4 w-4 mr-2 flex-shrink-0" />
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">统一风格</span>
              <span className="text-xs text-muted-foreground">
                整体调整，风格一致
              </span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  )
}