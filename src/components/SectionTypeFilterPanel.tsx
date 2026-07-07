'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { SectionType } from '@/lib/db/schema'

interface SectionTypeFilterPanelProps {
  selectedTypes: SectionType[]
  onTypeSelect: (type: SectionType) => void
  onClearFilters: () => void
}

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  achievement: '业绩',
  risk: '风险',
  routine: '日常',
  plan: '计划',
}

export function SectionTypeFilterPanel({
  selectedTypes,
  onTypeSelect,
  onClearFilters,
}: SectionTypeFilterPanelProps) {
  const allTypes: SectionType[] = ['achievement', 'risk', 'routine', 'plan']

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">类型筛选</h3>
        {selectedTypes.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onClearFilters}>
            清除
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {allTypes.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <Checkbox
              checked={selectedTypes.includes(type)}
              onCheckedChange={() => onTypeSelect(type)}
            />
            <span className="text-sm">{SECTION_TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
