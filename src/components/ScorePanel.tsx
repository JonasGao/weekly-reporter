'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ScorePanelProps {
  content: string
  onConfirm: () => void
  onCancel: () => void
}

export function ScorePanel({ content, onConfirm, onCancel }: ScorePanelProps) {
  const [loading, setLoading] = useState(false)
  const [score, setScore] = useState<{
    structure: number
    content: number
    value: number
    overall: number
  } | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])

  async function checkScore() {
    setLoading(true)
    try {
      const response = await fetch('/api/reports/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await response.json()
      setScore(data.score)
      setSuggestions(data.suggestions || [])
    } catch (error) {
      setScore({ structure: 0, content: 0, value: 0, overall: 0 })
      setSuggestions(['评分失败'])
    } finally {
      setLoading(false)
    }
  }

  if (!score && !loading) {
    return (
      <div className="p-4 border rounded-lg space-y-4">
        <div className="text-center">
          <p>点击下方按钮进行周报评分</p>
        </div>
        <div className="flex justify-center gap-4">
          <Button onClick={checkScore}>开始评分</Button>
          <Button variant="outline" onClick={onCancel}>取消</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 border rounded-lg text-center">
        正在评分中...
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="text-center font-medium text-lg">
        周报评分：{score?.overall || 0}分
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-sm text-muted-foreground">结构完整度</div>
          <div className="font-medium">{score?.structure || 0}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">内容充实度</div>
          <div className="font-medium">{score?.content || 0}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">价值突出度</div>
          <div className="font-medium">{score?.value || 0}</div>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="font-medium">改进建议</div>
          <div className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="text-sm text-muted-foreground">
                • {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4">
        <Button onClick={onConfirm}>确认保存</Button>
        <Button variant="outline" onClick={onCancel}>返回修改</Button>
      </div>
    </div>
  )
}