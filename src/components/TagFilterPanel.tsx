'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-react'

interface TagStat {
  name: string
  color: string | null
  usage_count: number
}

interface TagFilterPanelProps {
  tags: TagStat[]
  selectedTags: string[]
  onTagSelect: (tag: string) => void
  onClearFilters: () => void
  onManageTags?: () => void
}

export function TagFilterPanel({
  tags,
  selectedTags,
  onTagSelect,
  onClearFilters,
  onManageTags
}: TagFilterPanelProps) {
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">标签筛选</h3>
        {selectedTags.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onClearFilters}>
            清除筛选
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        {tags.map((tag) => (
          <div
            key={tag.name}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedTags.includes(tag.name)}
                onCheckedChange={() => onTagSelect(tag.name)}
              />
              <Badge
                variant="secondary"
                className="cursor-pointer"
                style={tag.color ? { backgroundColor: tag.color } : undefined}
              >
                #{tag.name}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {tag.usage_count}
            </span>
          </div>
        ))}
      </div>
      
      {onManageTags && (
        <Button size="sm" variant="outline" onClick={onManageTags} className="w-full">
          管理标签
        </Button>
      )}
    </div>
  )
}