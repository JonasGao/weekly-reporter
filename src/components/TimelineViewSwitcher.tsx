'use client'

import { Button } from '@/components/ui/button'

type ViewMode = 'day' | 'week' | 'month'

interface TimelineViewSwitcherProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

const VIEW_MODES: ViewMode[] = ['day', 'week', 'month']
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: '日',
  week: '周',
  month: '月',
}

export function TimelineViewSwitcher({ viewMode, onViewModeChange }: TimelineViewSwitcherProps) {
  return (
    <div className="flex rounded-md border">
      {VIEW_MODES.map((mode, index) => (
        <Button
          key={mode}
          type="button"
          variant={viewMode === mode ? 'default' : 'ghost'}
          size="sm"
          className={index === 0 ? 'rounded-r-none' : index === VIEW_MODES.length - 1 ? 'rounded-l-none' : 'rounded-none'}
          onClick={() => onViewModeChange(mode)}
          aria-pressed={viewMode === mode}
        >
          {VIEW_MODE_LABELS[mode]}
        </Button>
      ))}
    </div>
  )
}