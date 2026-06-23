'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { CheckPanel } from '@/components/CheckPanel'
import { ScorePanel } from '@/components/ScorePanel'
import { getWeekRange, formatDate } from '@/lib/utils'
import { getWeek, getYear, addWeeks, subWeeks } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { Template } from '@/lib/db/schema'

export default function NewReportPage() {
  const router = useRouter()
  const [baseDate, setBaseDate] = useState(new Date())
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [showScorePanel, setShowScorePanel] = useState(false)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const { start, end } = getWeekRange(baseDate)
  const weekStart = formatDate(start)
  const weekEnd = formatDate(end)
  const year = getYear(baseDate)
  const weekNumber = getWeek(baseDate, { weekStartsOn: 1 })

  const defaultTitle = `${year}年第${weekNumber}周工作周报`
  const [title, setTitle] = useState(defaultTitle)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      setTemplates(data.templates || [])
      if (data.templates?.length > 0) {
        const defaultTemplate = data.templates.find((t: Template) => t.isDefault)
        setSelectedTemplate(defaultTemplate || data.templates[0])
        setContent(defaultTemplate?.content || data.templates[0]?.content || '')
      }
    } catch (error) {
      toast.error('加载模板失败')
    }
  }

  function goToPrevWeek() {
    const newDate = subWeeks(baseDate, 1)
    setBaseDate(newDate)
    const newYear = getYear(newDate)
    const newWeekNumber = getWeek(newDate, { weekStartsOn: 1 })
    setTitle(`${newYear}年第${newWeekNumber}周工作周报`)
  }

  function goToNextWeek() {
    const newDate = addWeeks(baseDate, 1)
    setBaseDate(newDate)
    const newYear = getYear(newDate)
    const newWeekNumber = getWeek(newDate, { weekStartsOn: 1 })
    setTitle(`${newYear}年第${newWeekNumber}周工作周报`)
  }

  function handleTemplateChange(templateId: number) {
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSelectedTemplate(template)
      setContent(template.content)
    }
  }

  async function handleSubmit() {
    if (!content.trim()) {
      toast.error('请填写周报内容')
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
          weekStart,
          weekEnd,
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

  function handleSaveClick() {
    setShowScorePanel(true)
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">新建周报</h1>
      </div>

      <form className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="outline" size="icon" onClick={goToPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-medium">
            {year}年第{weekNumber}周 ({weekStart} ~ {weekEnd})
          </div>
          <Button type="button" variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template">模板</Label>
            <select
              id="template"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={selectedTemplate?.id || ''}
              onChange={(e) => handleTemplateChange(parseInt(e.target.value))}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.isDefault && ' (默认)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>内容</Label>
            <MilkdownEditor value={content} onChange={setContent} />
          </div>
          <div>
            <CheckPanel content={content} />
          </div>
        </div>

        {showScorePanel ? (
          <ScorePanel
            content={content}
            onConfirm={handleSubmit}
            onCancel={() => setShowScorePanel(false)}
          />
        ) : (
          <div className="flex justify-end gap-4">
            <Link href="/">
              <Button type="button" variant="outline">
                取消
              </Button>
            </Link>
            <Button type="button" onClick={handleSaveClick} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        )}
      </form>
    </main>
  )
}