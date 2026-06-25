'use client'

import { CollectSourceForm } from '@/components/CollectSourceForm'

export default function NewCollectSourcePage() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">新建采集源</h1>
      <CollectSourceForm />
    </main>
  )
}