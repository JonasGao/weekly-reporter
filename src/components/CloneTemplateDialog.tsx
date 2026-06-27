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
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
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
      toast.error('请填写模板名称')
      return
    }
    
    if (!content.trim()) {
      toast.error('请填写模板内容')
      return
    }
    
    setSaving(true)
    
    try {
      const sourceId = typeof template!.id === 'string' 
        ? template!.id 
        : `user-${template!.id}`
      
      await onClone({ sourceId, name, content })
      toast.success('模板已保存')
      onClose()
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }
  
  if (!template) return null
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>另存为个人模板</DialogTitle>
          <DialogDescription>
            从 "{template.name}" 另存为新的个人模板，可自定义修改
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">模板名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我的开发周报"
            />
          </div>
          
          <div className="space-y-2">
            <Label>模板内容</Label>
            <MilkdownEditor value={content} onChange={setContent} />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}