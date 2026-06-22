'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { Report } from '@/lib/db/schema'

export default function EditReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await fetch(`/api/reports/${id}`)
        if (response.ok) {
          const report: Report = await response.json()
          setTitle(report.title)
          setContent(report.content)
          setWeekStart(report.weekStart)
          setWeekEnd(report.weekEnd)
        } else {
          toast.error('周报不存在')
          router.push('/')
        }
      } catch (error) {
        toast.error('加载失败')
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      toast.error('请填写所有必填项')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          weekStart,
          weekEnd,
        }),
      })

      if (response.ok) {
        toast.success('周报已更新')
        router.push('/')
      } else {
        const error = await response.json()
        toast.error(error.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="text-center">加载中...</div>
      </main>
    )
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">编辑周报</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：2024年第1周工作周报"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>开始日期（周一）</Label>
            <div className="text-sm text-muted-foreground py-1.5">{weekStart}</div>
          </div>
          <div className="space-y-2">
            <Label>结束日期（周日）</Label>
            <div className="text-sm text-muted-foreground py-1.5">{weekEnd}</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>内容</Label>
          <MilkdownEditor value={content} onChange={setContent} />
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/">
            <Button type="button" variant="outline">
              取消
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </form>
    </main>
  )
}