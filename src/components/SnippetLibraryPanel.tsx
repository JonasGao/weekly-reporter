'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { SentenceSnippet } from '@/lib/db/schema'

interface SnippetLibraryPanelProps {
  onSelectSnippet?: (snippet: string) => void
}

export function SnippetLibraryPanel({ onSelectSnippet }: SnippetLibraryPanelProps) {
  const [snippets, setSnippets] = useState<SentenceSnippet[]>([])
  const [categories, setCategories] = useState<string[]>(['全部'])
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  useEffect(() => {
    fetchSnippets()
  }, [])

  const fetchSnippets = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/snippets')
      if (!response.ok) throw new Error('获取片段失败')
      
      const data = await response.json()
      setSnippets(data.snippets || [])
      
      // Extract unique categories
      const uniqueCategories = new Set(['全部'])
      data.snippets?.forEach((snippet: SentenceSnippet) => {
        if (snippet.category) {
          uniqueCategories.add(snippet.category)
        }
      })
      setCategories(Array.from(uniqueCategories))
    } catch (error) {
      console.error('Failed to fetch snippets:', error)
      toast.error('获取片段库失败')
    } finally {
      setLoading(false)
    }
  }

  const filteredSnippets = selectedCategory === '全部'
    ? snippets
    : snippets.filter(s => s.category === selectedCategory)

  const handleCopy = async (snippet: SentenceSnippet) => {
    try {
      await navigator.clipboard.writeText(snippet.content)
      setCopiedId(snippet.id)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  const handleClick = (snippet: SentenceSnippet) => {
    onSelectSnippet?.(snippet.content)
    toast.success('已插入片段')
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          分类筛选
        </label>
        <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as string)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择分类" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            句子片段
          </label>
          <span className="text-xs text-muted-foreground">
            {filteredSnippets.length} 条片段
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">加载中...</div>
          </div>
        ) : filteredSnippets.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">
              {selectedCategory === '全部' ? '暂无片段' : '该分类暂无片段'}
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 -mr-1">
            {filteredSnippets.map((snippet) => (
              <Card
                key={snippet.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors group"
                onClick={() => handleClick(snippet)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <p className="text-sm flex-1 leading-relaxed">
                      {snippet.content}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopy(snippet)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
                      aria-label="复制"
                    >
                      {copiedId === snippet.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  {snippet.category && (
                    <div className="mt-1.5">
                      <span className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full">
                        {snippet.category}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}