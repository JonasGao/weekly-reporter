'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import type { ScoreStatus } from '@/lib/db/schema'

interface ScoreBadgeProps {
  scoreStatus: ScoreStatus
  scoreOverall?: number | null
  scoreError?: string | null
  onRetry?: () => void
}

export function ScoreBadge({ scoreStatus, scoreOverall, scoreError, onRetry }: ScoreBadgeProps) {
  const [retrying, setRetrying] = useState(false)
  
  const handleRetry = async () => {
    if (!onRetry) return
    
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }
  
  if (scoreStatus === 'pending') {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>待评分</span>
      </div>
    )
  }
  
  if (scoreStatus === 'scoring') {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>评分中</span>
      </div>
    )
  }
  
  if (scoreStatus === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>评分失败</span>
        </div>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            disabled={retrying}
            className="h-6 px-2"
          >
            {retrying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    )
  }
  
  if (scoreStatus === 'completed' && scoreOverall !== null) {
    return (
      <div className="flex items-center gap-1 text-sm text-green-500">
        <CheckCircle className="h-4 w-4" />
        <span>{scoreOverall}分</span>
      </div>
    )
  }
  
  return null
}