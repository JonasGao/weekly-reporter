'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, Check, Lock } from 'lucide-react'
import { useState } from 'react'
import type { SentenceSnippet } from '@/lib/db/schema'

interface SnippetCardProps {
  snippet: SentenceSnippet
  onSelect?: (snippet: SentenceSnippet) => void
}

export function SnippetCard({ snippet, onSelect }: SnippetCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(snippet.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50"
      onClick={() => onSelect?.(snippet)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed text-foreground">
              {snippet.content}
            </p>
            
            {/* Footer with category and built-in indicator */}
            <div className="flex items-center gap-2 mt-3">
              {snippet.category && (
                <Badge variant="secondary" className="text-xs">
                  {snippet.category}
                </Badge>
              )}
              
              {snippet.isBuiltIn && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>内置</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Copy button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            aria-label="复制片段"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}