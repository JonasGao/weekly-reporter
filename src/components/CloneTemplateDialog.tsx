'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import dynamic from 'next/dynamic'

const MilkdownEditor = dynamic(
  () => import('@/components/editor/MilkdownEditor').then(m => ({ default: m.MilkdownEditor })),
  { ssr: false }
)
import { toast } from 'sonner'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

interface CloneTemplateDialogProps {
  template: OfficialTemplate | Template | null
  open: boolean
  onClose: () => void
  onClone: (data: { sourceId: string; name: string; content: string }) => Promise<void>
}

export function CloneTemplateDialog({ 
  template, 
  open, 
  onClose, 
  onClone 
}: CloneTemplateDialogProps) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  
  // 当对话框打开时，初始化内容
  useEffect(() => {
    if (template && open) {
      setName('')
      setContent(template.content)
    }
  }, [template, open])
  
  async function handleSave() {
    if (!name.trim()) {
      toast.error('Please enter a template name')
      return
    }
    
    if (!content.trim()) {
      toast.error('Please enter template content')
      return
    }
    
    setSaving(true)
    
    try {
      const sourceId = typeof template!.id === 'string' 
        ? template!.id 
        : `user-${template!.id}`
      
      await onClone({ sourceId, name, content })
      toast.success('Template saved')
      onClose()
    } catch (error) {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }
  
  if (!template) return null
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Save as personal template</DialogTitle>
          <DialogDescription>
            Save “{template.name}” as a new personal template and customize it.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My development report"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Template content</Label>
            <MilkdownEditor value={content} onChange={setContent} />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
