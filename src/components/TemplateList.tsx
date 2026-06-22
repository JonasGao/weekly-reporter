'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'sonner'
import { Edit, Trash2 } from 'lucide-react'
import type { Template } from '@/lib/db/schema'

interface TemplateListProps {
  onSelect?: (template: Template) => void
}

export function TemplateList({ onSelect }: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      toast.error('加载模板失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number, isDefault: boolean) {
    if (isDefault) {
      toast.error('默认模板不可删除')
      return
    }

    if (!confirm('确定要删除这个模板吗？')) return

    try {
      const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setTemplates(templates.filter((t) => t.id !== id))
        toast.success('模板已删除')
      } else {
        const error = await response.json()
        toast.error(error.error || '删除失败')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="border rounded-lg p-4 flex items-center justify-between"
        >
          <div>
            <div className="font-medium">
              {template.name}
              {template.isDefault && (
                <span className="text-xs text-muted-foreground ml-2">(默认)</span>
              )}
            </div>
            {template.workTypes && (
              <div className="text-sm text-muted-foreground">
                适用：{template.workTypes}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onSelect && (
              <Button variant="outline" size="sm" onClick={() => onSelect(template)}>
                使用
              </Button>
            )}
            {!template.isDefault && (
              <>
                <Link href={`/templates/${template.id}`}>
                  <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(template.id, template.isDefault)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}