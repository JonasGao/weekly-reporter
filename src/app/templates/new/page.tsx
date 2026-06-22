'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TemplateForm } from '@/components/TemplateForm'
import { ArrowLeft } from 'lucide-react'

export default function NewTemplatePage() {
  const router = useRouter()

  async function handleSave(data: { name: string; content: string; workTypes?: string }) {
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('保存失败')
    }

    router.push('/templates')
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">新建模板</h1>
      </div>

      <TemplateForm
        onSave={handleSave}
        onCancel={() => router.push('/templates')}
      />
    </main>
  )
}