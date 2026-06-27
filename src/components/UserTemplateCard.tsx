'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Edit, Trash2 } from 'lucide-react'
import type { Template } from '@/lib/db/schema'

interface UserTemplateCardProps {
  template: Template
  onUse?: (template: Template) => void
  onDelete: (id: number) => void
}

export function UserTemplateCard({ template, onUse, onDelete }: UserTemplateCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-medium text-lg">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}
          {template.tags && (
            <div className="text-xs text-muted-foreground">
              标签: {template.tags}
            </div>
          )}
          {template.sourceTemplateId && (
            <div className="text-xs text-muted-foreground">
              来源: {template.sourceTemplateId.startsWith('official-') 
                ? '官方模板' 
                : '用户模板'}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onUse && (
            <Button variant="outline" size="sm" onClick={() => onUse(template)}>
              使用
            </Button>
          )}
          <Link href={`/templates/${template.id}`}>
            <Button variant="ghost" size="icon">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(template.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}