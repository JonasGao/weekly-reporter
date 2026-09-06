'use client'

import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import type { Report } from '@/lib/db/schema'
import { formatSystemDateTime } from '@/lib/time-format'

interface ScoreCardProps {
  report: Report
}

export function ScoreCard({ report }: ScoreCardProps) {
  const { scoreStatus, scoreStructure, scoreContent, scoreValue, scoreOverall, suggestions, scoredAt, scoreError } = report
  
  if (scoreStatus === 'pending') {
    return (
      <div className="bg-[#141414] border border-[#1c1c1c] rounded-xl p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Awaiting score</span>
        </div>
      </div>
    )
  }
  
  if (scoreStatus === 'scoring') {
    return (
      <div className="bg-[#141414] border border-[#1c1c1c] rounded-xl p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Scoring...</span>
        </div>
      </div>
    )
  }
  
  if (scoreStatus === 'failed') {
    return (
      <div className="bg-[#141414] border border-[#1c1c1c] rounded-xl p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>Scoring failed</span>
        </div>
        {scoreError && (
          <p className="text-sm text-muted-foreground mt-2">{scoreError}</p>
        )}
      </div>
    )
  }
  
  if (scoreStatus === 'completed' && scoreOverall !== null) {
    return (
      <div className="bg-[#141414] border border-[#1c1c1c] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="font-medium">Score</span>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-muted-foreground">Structure</div>
            <div className="text-2xl font-bold">{scoreStructure || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Content</div>
            <div className="text-2xl font-bold">{scoreContent || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Value</div>
            <div className="text-2xl font-bold">{scoreValue || 0}</div>
          </div>
        </div>
        
        <div className="text-center pt-2 border-t border-[#1c1c1c]">
          <div className="text-sm text-muted-foreground">Overall</div>
          <div className="text-3xl font-bold text-green-500">{scoreOverall}</div>
        </div>
        
        {suggestions && suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium">Suggestions</div>
            <div className="space-y-1">
              {suggestions.split('\n').map((suggestion, index) => (
                <div key={index} className="text-sm text-muted-foreground">
                  • {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {scoredAt && (
          <div className="text-xs text-muted-foreground text-right">
            <span suppressHydrationWarning>Scored at: {formatSystemDateTime(scoredAt)}</span>
          </div>
        )}
      </div>
    )
  }
  
  return null
}
