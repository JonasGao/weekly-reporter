'use client'

import { Button } from '@/components/ui/button'
import type { OfficialTemplate } from '@/lib/official-templates'

interface OfficialTemplateCardProps {
  template: OfficialTemplate
  onClone: (templateId: string) => void
  onSaveAs: (templateId: string) => void
  onView: (templateId: string) => void
}

export function OfficialTemplateCard({ template, onClone, onSaveAs, onView }: OfficialTemplateCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-medium text-lg">{template.name}</h3>
          <p className="text-sm text-muted-foreground">{template.description}</p>
          {template.tags.length > 0 && (
            <div className="text-xs text-muted-foreground">
              标签: {template.tags.join(', ')}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onView(template.id)}
        >
          查看详情
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onClone(template.id)}
        >
          快速克隆
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSaveAs(template.id)}
        >
          另存为
        </Button>
      </div>
    </div>
  )
}