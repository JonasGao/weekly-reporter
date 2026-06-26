'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CollectSourceList } from '@/components/CollectSourceList'
import { ScanReposDialog } from '@/components/ScanReposDialog'
import { ArrowLeft, Plus, FolderGit2 } from 'lucide-react'

export default function CollectPage() {
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const refreshFnRef = useRef<(() => void) | null>(null)
  
  const handleRefreshReady = (fetchFn: () => void) => {
    refreshFnRef.current = fetchFn
  }
  
  const handleScanSuccess = () => {
    if (refreshFnRef.current) {
      refreshFnRef.current()
    }
  }
  
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScanDialogOpen(true)}>
            <FolderGit2 className="h-4 w-4 mr-2" />
            扫描目录
          </Button>
          <Link href="/collect/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建采集源
            </Button>
          </Link>
        </div>
      </div>

      <CollectSourceList onRefresh={handleRefreshReady} />
      
      <ScanReposDialog
        open={scanDialogOpen}
        onClose={() => setScanDialogOpen(false)}
        onSuccess={handleScanSuccess}
      />
    </main>
  )
}