'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addWeeks, getWeek, getYear, subWeeks } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getWeekRange, formatDate } from '@/lib/utils'

export default function NewReportPage() {
  const router = useRouter()
  const [baseDate, setBaseDate] = useState(new Date())
  const [saving, setSaving] = useState(false)

  const { start, end } = getWeekRange(baseDate)
  const weekStart = formatDate(start)
  const weekEnd = formatDate(end)
  const year = getYear(baseDate)
  const weekNumber = getWeek(baseDate, { weekStartsOn: 1 })
  const [title, setTitle] = useState(`${year}年第${weekNumber}周工作周报`)

  function changeWeek(nextDate: Date) {
    setBaseDate(nextDate)
    setTitle(`${getYear(nextDate)}年第${getWeek(nextDate, { weekStartsOn: 1 })}周工作周报`)
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error('请填写标题')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), weekStart, weekEnd }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || '创建失败')
      }
      toast.success('周报原稿已创建')
      router.push(`/reports/${data.report.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">新建周报</h1>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="outline" size="icon" onClick={() => changeWeek(subWeeks(baseDate, 1))} aria-label="上一周">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-medium">
            {year}年第{weekNumber}周 ({weekStart} ~ {weekEnd})
          </div>
          <Button type="button" variant="outline" size="icon" onClick={() => changeWeek(addWeeks(baseDate, 1))} aria-label="下一周">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
          <p>创建时会按现有事件来源和时间规则生成领导版、个人版两份原稿。</p>
          <p>模板和 AI 生成在创建后进行；没有 AI 配置也不影响原稿保存。</p>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? '创建中...' : '创建原稿'}
          </Button>
        </div>
      </div>
    </main>
  )
}
