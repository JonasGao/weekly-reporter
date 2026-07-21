'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ScoreCard } from '@/components/ScoreCard'
import type { Report } from '@/lib/db/schema'

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchReport() {
      try {
        const response = await fetch(`/api/reports/${id}`)
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('周报不存在')
          }
          throw new Error('加载周报失败')
        }
        const data = await response.json()
        if (!cancelled) {
          setReport(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载周报失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchReport()

    return () => {
      cancelled = true
    }
  }, [id])

  async function handleDelete() {
    if (!confirm('确定要删除这篇周报吗？')) return

    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('周报已删除')
        router.push('/reports')
      } else {
        toast.error('删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-6 max-w-[920px]">
        <div className="text-center py-8">加载中...</div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="container mx-auto py-8 px-6 max-w-[920px]">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          返回周报列表
        </Link>
        <div className="text-center py-8">
          <p className="text-muted-foreground">{error || '周报不存在'}</p>
        </div>
      </div>
    )
  }

  const weekStart = format(new Date(report.weekStart), 'MM/dd', { locale: zhCN })
  const weekEnd = format(new Date(report.weekEnd), 'MM/dd', { locale: zhCN })
  const createdAt = format(new Date(report.createdAt), 'yyyy-MM-dd', { locale: zhCN })

  return (
    <div className="container mx-auto py-8 px-6 max-w-[920px]">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回周报列表
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 max-[720px]:flex-col">
        <div className="flex-1">
          <h1 className="text-[28px] font-bold mb-2.5">{report.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {weekStart} - {weekEnd}
            </span>
            <span className="text-[#404040]">·</span>
            <span>创建于 {createdAt}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href={`/edit/${report.id}`}>
            <Button>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              编辑
            </Button>
          </Link>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            删除
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <ScoreCard report={report} />
      </div>

      <div className="bg-[#141414] border border-[#1c1c1c] rounded-xl p-7 max-[720px]:p-5">
        <div className="prose prose-invert prose-report">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
