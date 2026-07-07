'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

export type SourceFilter = 'manual' | 'auto'

interface SourceFilterPanelProps {
  selectedSources: SourceFilter[]
  onSourceSelect: (source: SourceFilter) => void
  onClearFilters: () => void
}

const SOURCE_LABELS: Record<SourceFilter, string> = {
  manual: '手动录入',
  auto: '自动采集',
}

export function SourceFilterPanel({
  selectedSources,
  onSourceSelect,
  onClearFilters,
}: SourceFilterPanelProps) {
  const sources: SourceFilter[] = ['manual', 'auto']

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">来源筛选</h3>
        {selectedSources.length > 0 && selectedSources.length < 2 && (
          <Button size="sm" variant="ghost" onClick={onClearFilters}>
            清除
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <Checkbox
              checked={selectedSources.includes(s)}
              onCheckedChange={() => onSourceSelect(s)}
            />
            <span className="text-sm">{SOURCE_LABELS[s]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
