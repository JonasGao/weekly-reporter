'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/DatePicker'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { getWeekRange, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function NewReportPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const { start } = getWeekRange(new Date())
    return start
  })
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    const { end } = getWeekRange(new Date())
    return end
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim() || !content.trim() || !startDate || !endDate) {
      toast.error('请填写所有必填项')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          weekStart: formatDate(startDate),
          weekEnd: formatDate(endDate),
        }),
      })

      if (response.ok) {
        toast.success('周报已创建')
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

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">新建周报</h1>
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
            <Label>开始日期</Label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="选择开始日期"
            />
          </div>
          <div className="space-y-2">
            <Label>结束日期</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="选择结束日期"
            />
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