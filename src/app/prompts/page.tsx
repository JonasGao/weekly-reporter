'use client'

import { PromptManager } from '@/components/PromptManager'

export default function PromptsPage() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">提示词管理</h1>
      <PromptManager />
    </main>
  )
}
