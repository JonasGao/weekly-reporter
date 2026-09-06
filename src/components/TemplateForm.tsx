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
  onSave: (data: { 
    name: string
    content: string
    description?: string
    tags?: string
  }) => Promise<void>
  onCancel: () => void
}

export function TemplateForm({ template, onSave, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(template?.name || '')
  const [content, setContent] = useState(template?.content || '')
  const [description, setDescription] = useState(template?.description || '')
  const [tags, setTags] = useState(template?.tags || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !content.trim()) {
      toast.error('Please enter a template name and content')
      return
    }

    setSaving(true)

    try {
      await onSave({ 
        name, 
        content, 
        description: description.trim() || undefined,
        tags: tags.trim() || undefined,
      })
      toast.success('Template saved')
    } catch (error) {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Template name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Development weekly report"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. For engineering teams"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. development, engineering"
        />
      </div>

      <div className="space-y-2">
        <Label>Template content</Label>
        <MilkdownEditor value={content} onChange={setContent} />
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
