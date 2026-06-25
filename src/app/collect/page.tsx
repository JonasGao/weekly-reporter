'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CollectSourceList } from '@/components/CollectSourceList'
import { ArrowLeft, Plus } from 'lucide-react'

export default function CollectPage() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">采集源管理</h1>
        </div>
        <Link href="/collect/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新建采集源
          </Button>
        </Link>
      </div>

      <CollectSourceList />
    </main>
  )
}