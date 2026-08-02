'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SyncResult } from '@/lib/collect/sync'

interface SyncResultsCardProps {
  results: SyncResult[]
  onClose: () => void
}

export function SyncResultsCard({ results, onClose }: SyncResultsCardProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set())

  const successCount = results.filter(r => r.status === 'success').length
  const failedCount = results.filter(r => r.status === 'failed').length

  const toggleError = (sourceId: number) => {
    setExpandedErrors(prev => {
      const next = new Set(prev)
      if (next.has(sourceId)) {
        next.delete(sourceId)
      } else {
        next.add(sourceId)
      }
      return next
    })
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span>同步结果</span>
          <div className="flex gap-2">
            <Badge variant="default" className="bg-green-600">
              {successCount} 成功
            </Badge>
            <Badge
              variant={failedCount > 0 ? 'destructive' : 'secondary'}
            >
              {failedCount} 失败
            </Badge>
          </div>
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {results.map(result => (
            <SyncResultRow
              key={result.sourceId}
              result={result}
              expanded={expandedErrors.has(result.sourceId)}
              onToggle={() => toggleError(result.sourceId)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface SyncResultRowProps {
  result: SyncResult
  expanded: boolean
  onToggle: () => void
}

function SyncResultRow({ result, expanded, onToggle }: SyncResultRowProps) {
  const { status, sourceName, commitsCount, eventsCount, error, warnings } = result

  if (status === 'failed') {
    const isLongError = error && error.length > 100
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
        <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{sourceName}</div>
          {error && (
            <div className="mt-1">
              <div
                className={cn(
                  'text-sm text-muted-foreground break-words',
                  !expanded && isLongError && 'line-clamp-2'
                )}
              >
                {error}
              </div>
              {isLongError && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggle}
                  className="h-6 px-2 mt-1 text-xs"
                >
                  {expanded ? (
                    <>
                      收起 <ChevronUp className="h-3 w-3 ml-1" />
                    </>
                  ) : (
                    <>
                      展开 <ChevronDown className="h-3 w-3 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (warnings && warnings.length > 0) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/30">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{sourceName}</div>
          <div className="text-sm text-muted-foreground mt-1">
            同步成功，但部分路径失败
          </div>
          <ul className="mt-2 space-y-1">
            {warnings.map((warning, idx) => (
              <li
                key={idx}
                className="text-xs text-muted-foreground break-words"
              >
                • {warning}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-xs text-muted-foreground">
            commits: {commitsCount}, events: {eventsCount}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{sourceName}</div>
      </div>
      <div className="text-xs text-muted-foreground">
        commits: {commitsCount}, events: {eventsCount}
      </div>
    </div>
  )
}
