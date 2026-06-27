'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { TemplateTabs } from '@/components/TemplateTabs'
import { CloneTemplateDialog } from '@/components/CloneTemplateDialog'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

interface TemplateListProps {
  onSelect?: (template: Template) => void
}

export function TemplateList({ onSelect }: TemplateListProps) {
  const router = useRouter()
  const [officialTemplates, setOfficialTemplates] = useState<OfficialTemplate[]>([])
  const [userTemplates, setUserTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplateForSaveAs, setSelectedTemplateForSaveAs] = useState<OfficialTemplate | Template | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      setOfficialTemplates(data.official || [])
      setUserTemplates(data.user || [])
    } catch (error) {
      toast.error('加载模板失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleClone(templateId: string) {
    try {
      const response = await fetch('/api/templates/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: templateId }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('模板已克隆')
        router.push(`/templates/${data.template.id}`)
      } else {
        const error = await response.json()
        toast.error(error.error || '克隆失败')
      }
    } catch (error) {
      toast.error('克隆失败')
    }
  }

  function handleSaveAs(templateId: string) {
    const template = officialTemplates.find(t => t.id === templateId) 
      || userTemplates.find(t => `user-${t.id}` === templateId)
    
    if (template) {
      setSelectedTemplateForSaveAs(template)
      setDialogOpen(true)
    }
  }

  async function handleCloneWithEdit(data: { sourceId: string; name: string; content: string }) {
    try {
      const response = await fetch('/api/templates/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('模板已保存')
        router.push(`/templates/${result.template.id}`)
        fetchTemplates() // 刷新列表
      } else {
        const error = await response.json()
        toast.error(error.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确定要删除这个模板吗？')) return

    try {
      const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setUserTemplates(userTemplates.filter((t) => t.id !== id))
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
    <>
      <TemplateTabs
        officialTemplates={officialTemplates}
        userTemplates={userTemplates}
        onCloneOfficial={handleClone}
        onSaveAsOfficial={handleSaveAs}
        onDeleteUser={handleDelete}
      />
      
      <CloneTemplateDialog
        template={selectedTemplateForSaveAs}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onClone={handleCloneWithEdit}
      />
    </>
  )
}