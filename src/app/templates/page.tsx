'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TemplateList } from '@/components/TemplateList'
import { ArrowLeft, Plus } from 'lucide-react'

export default function TemplatesPage() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">模板管理</h1>
        </div>
        <Link href="/templates/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新建模板
          </Button>
        </Link>
      </div>

      <TemplateList />
    </main>
  )
}