'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Tag, SectionType } from '@/lib/db/schema'

const SECTION_TYPES: SectionType[] = ['achievement', 'risk', 'routine', 'plan']
const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  achievement: '成果',
  risk: '风险',
  routine: '日常',
  plan: '计划',
}

const PRESET_COLORS = [
  'blue', 'green', 'red', 'yellow', 'purple', 
  'orange', 'cyan', 'magenta', 'lime', 'pink'
]

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    sectionType: 'routine' as SectionType,
    color: '',
  })

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      setTags(data)
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.name.trim()) return

    try {
      if (editingTag) {
        await fetch(`/api/tags/${editingTag.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      
      loadTags()
      setDialogOpen(false)
      setEditingTag(null)
      setForm({ name: '', sectionType: 'routine', color: '' })
    } catch (error) {
      console.error('Failed to save tag:', error)
    }
  }

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag)
    setForm({
      name: tag.name,
      sectionType: tag.sectionType || 'routine',
      color: tag.color || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此标签？')) return
    
    try {
      await fetch(`/api/tags/${id}`, { method: 'DELETE' })
      loadTags()
    } catch (error) {
      console.error('Failed to delete tag:', error)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">标签管理</h1>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={
            <Button onClick={() => {
              setEditingTag(null)
              setForm({ name: '', sectionType: 'routine', color: '' })
            }} />
          }>
            新建标签
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTag ? '编辑标签' : '新建标签'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">标签名称</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="输入标签名称"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">映射分类</label>
                <div className="flex gap-2 mt-2">
                  {SECTION_TYPES.map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={form.sectionType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setForm(prev => ({ ...prev, sectionType: type }))}
                    >
                      {SECTION_TYPE_LABELS[type]}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">颜色</label>
                <div className="flex gap-2 mt-2">
                  {PRESET_COLORS.map((color) => (
                    <Button
                      key={color}
                      type="button"
                      variant={form.color === color ? 'default' : 'outline'}
                      size="sm"
                      className="w-8 h-8"
                      style={{ backgroundColor: color }}
                      onClick={() => setForm(prev => ({ ...prev, color }))}
                    />
                  ))}
                  <Button
                    type="button"
                    variant={form.color === '' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setForm(prev => ({ ...prev, color: '' }))}
                  >
                    无
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit">
                  保存
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">标签名</th>
              <th className="px-4 py-3 text-left text-sm font-medium">映射分类</th>
              <th className="px-4 py-3 text-left text-sm font-medium">颜色</th>
              <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <Badge
                    variant="secondary"
                    style={tag.color ? { backgroundColor: tag.color } : undefined}
                  >
                    #{tag.name}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">
                  {SECTION_TYPE_LABELS[tag.sectionType || 'routine']}
                </td>
                <td className="px-4 py-3">
                  {tag.color && (
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(tag)}
                    >
                      编辑
                    </Button>
                    {!tag.isBuiltIn && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(tag.id)}
                      >
                        删除
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}