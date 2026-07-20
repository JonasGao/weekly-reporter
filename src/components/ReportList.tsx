'use client'

import { useState, useEffect } from 'react'
import { ReportCard } from './ReportCard'
import { SearchBar } from './SearchBar'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Report } from '@/lib/db/schema'

export function ReportList() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchReports() {
    try {
      const response = await fetch('/api/reports')
      const data = await response.json()
      setReports(data.reports || [])
    } catch (error) {
      toast.error('加载周报失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch('/api/reports')
        const data = await response.json()
        if (!cancelled) {
          setReports(data.reports || [])
        }
      } catch (error) {
        if (!cancelled) {
          toast.error('加载周报失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSearch(query: string) {
    if (!query.trim()) {
      fetchReports()
      return
    }

    try {
      const response = await fetch(`/api/reports/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setReports(data.reports || [])
    } catch (error) {
      toast.error('搜索失败')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确定要删除这篇周报吗？')) return

    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setReports(reports.filter((r) => r.id !== id))
        toast.success('周报已删除')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold max-[720px]:text-[24px]">周报编辑器</h1>
        <div className="flex items-center gap-2">
          <Link href="/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建周报
            </Button>
          </Link>
        </div>
      </div>

      <SearchBar onSearch={handleSearch} />

      {reports.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          暂无周报，点击&quot;新建周报&quot;开始创建
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}