'use client'

import { TemplateList } from '@/components/TemplateList'

export default function TemplatesPage() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">模板管理</h1>
      <TemplateList />
    </main>
  )
}