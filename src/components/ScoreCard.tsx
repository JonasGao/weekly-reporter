'use client'

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import type { Report } from '@/lib/db/schema'

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
          <span className="text-muted-foreground">待评分</span>
        </div>
      </div>
    )
  }
  
  if (scoreStatus === 'scoring') {
    return (
      <div className="bg-[#141414] border border-[#1c1c1c] rounded-xl p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">评分中...</span>
        </div>
      </div>
    )
  }
  
  if (scoreStatus === 'failed') {
    return (
      <div className="bg-[#141414] border border-[#1c1c1c] rounded-xl p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>评分失败</span>
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
          <span className="font-medium">评分结果</span>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-muted-foreground">结构完整度</div>
            <div className="text-2xl font-bold">{scoreStructure || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">内容充实度</div>
            <div className="text-2xl font-bold">{scoreContent || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">价值突出度</div>
            <div className="text-2xl font-bold">{scoreValue || 0}</div>
          </div>
        </div>
        
        <div className="text-center pt-2 border-t border-[#1c1c1c]">
          <div className="text-sm text-muted-foreground">综合评分</div>
          <div className="text-3xl font-bold text-green-500">{scoreOverall}分</div>
        </div>
        
        {suggestions && suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium">改进建议</div>
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
            评分时间: {format(new Date(scoredAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
          </div>
        )}
      </div>
    )
  }
  
  return null
}