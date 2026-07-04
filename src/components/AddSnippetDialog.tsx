'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { SentenceSnippet } from '@/lib/db/schema'

interface AddSnippetDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (snippet: SentenceSnippet) => void
}

const PRESET_CATEGORIES = [
  '通用',
  '成果展示',
  '问题解决',
  '团队协作',
  '学习成长',
  '项目进展',
  '技术突破',
  '其他',
]

export function AddSnippetDialog({ open, onClose, onAdd }: AddSnippetDialogProps) {
  const [category, setCategory] = useState('通用')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!content.trim()) {
      toast.error('请输入片段内容')
      return
    }

    if (content.length > 500) {
      toast.error('内容长度不能超过500个字符')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          category,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '添加失败')
      }

      const data = await response.json()
      onAdd(data.snippet)
      toast.success('片段已添加')
      
      // Reset form
      setContent('')
      setCategory('通用')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setContent('')
    setCategory('通用')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加句子片段</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">分类</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as string)}>
              <SelectTrigger id="category">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">内容</Label>
              <span className={`text-xs ${content.length > 500 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {content.length}/500
              </span>
            </div>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入要保存的句子片段..."
              className="w-full min-h-[120px] px-3 py-2 text-sm border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all"
              rows={5}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}