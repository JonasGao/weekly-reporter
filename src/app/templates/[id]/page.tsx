'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TemplateForm } from '@/components/TemplateForm'
import { toast } from 'sonner'
import type { Template } from '@/lib/db/schema'

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTemplate()
  }, [id])

  async function fetchTemplate() {
    try {
      const response = await fetch(`/api/templates/${id}`)
      if (response.ok) {
        const data = await response.json()
        setTemplate(data.template)
      } else {
        toast.error('模板不存在')
        router.push('/templates')
      }
    } catch (error) {
      toast.error('加载失败')
      router.push('/templates')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(data: { 
    name: string
    content: string
    description?: string
    tags?: string
  }) {
    const response = await fetch(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (response.ok) {
      router.push('/templates')
    } else {
      const error = await response.json()
      toast.error(error.error || '更新失败')
      throw new Error('更新失败')
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="text-center py-8">加载中...</div>
      </main>
    )
  }

  if (!template) {
    return null
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/templates">
          <Button variant="ghost" size="icon">←</Button>
        </Link>
        <h1 className="text-2xl font-bold">编辑模板</h1>
      </div>

      <TemplateForm 
        template={template} 
        onSave={handleSave} 
        onCancel={() => router.push('/templates')} 
      />
    </main>
  )
}