'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type StatusFilter = 'all' | 'pending' | 'processed'

interface StatusFilterPanelProps {
  selectedStatus: StatusFilter
  onStatusSelect: (status: StatusFilter) => void
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'processed', label: '已处理' },
]

export function StatusFilterPanel({
  selectedStatus,
  onStatusSelect,
}: StatusFilterPanelProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {STATUS_OPTIONS.map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant={selectedStatus === option.value ? 'default' : 'ghost'}
          onClick={() => onStatusSelect(option.value)}
          className={cn(
            'h-7 px-3 text-xs',
            selectedStatus === option.value && 'shadow-sm'
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
