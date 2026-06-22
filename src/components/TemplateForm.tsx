'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { toast } from 'sonner'
import type { Template } from '@/lib/db/schema'

interface TemplateFormProps {
  template?: Template
  onSave: (data: { name: string; content: string; workTypes?: string }) => Promise<void>
  onCancel: () => void
}

export function TemplateForm({ template, onSave, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(template?.name || '')
  const [content, setContent] = useState(template?.content || '')
  const [workTypes, setWorkTypes] = useState(template?.workTypes || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !content.trim()) {
      toast.error('请填写模板名称和内容')
      return
    }

    setSaving(true)

    try {
      await onSave({ name, content, workTypes: workTypes.trim() || undefined })
      toast.success('模板已保存')
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">模板名称</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：开发周报模板"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="workTypes">适用工作类型</Label>
        <Input
          id="workTypes"
          value={workTypes}
          onChange={(e) => setWorkTypes(e.target.value)}
          placeholder="例如：开发,技术,产品"
        />
      </div>

      <div className="space-y-2">
        <Label>模板内容</Label>
        <MilkdownEditor value={content} onChange={setContent} />
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  )
}