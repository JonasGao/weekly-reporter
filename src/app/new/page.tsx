'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { CheckPanel } from '@/components/CheckPanel'
import { ScorePanel } from '@/components/ScorePanel'
import { TemplateSelect } from '@/components/TemplateSelect'
import { VariableToolbar } from '@/components/VariableToolbar'
import { getWeekRange, formatDate } from '@/lib/utils'
import { getWeek, getYear, addWeeks, subWeeks } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

export default function NewReportPage() {
  const router = useRouter()
  const [baseDate, setBaseDate] = useState(new Date())
  const [officialTemplates, setOfficialTemplates] = useState<OfficialTemplate[]>([])
  const [userTemplates, setUserTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [showScorePanel, setShowScorePanel] = useState(false)
  const [content, setContent] = useState('')
  const [editorKey, setEditorKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const latestRenderRef = useRef<string>('')

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
      setOfficialTemplates(data.official || [])
      setUserTemplates(data.user || [])
      
      // 默认选择第一个官方模板
      if (data.official?.length > 0) {
        const firstOfficial = data.official[0]
        setSelectedTemplateId(firstOfficial.id)
        setContent(firstOfficial.content)
        setEditorKey(k => k + 1)
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

    if (selectedTemplateId) {
      handleTemplateChange(selectedTemplateId, newDate)
    }
  }

  function goToNextWeek() {
    const newDate = addWeeks(baseDate, 1)
    setBaseDate(newDate)
    const newYear = getYear(newDate)
    const newWeekNumber = getWeek(newDate, { weekStartsOn: 1 })
    setTitle(`${newYear}年第${newWeekNumber}周工作周报`)

    if (selectedTemplateId) {
      handleTemplateChange(selectedTemplateId, newDate)
    }
  }

  function handleInsertVariable(variable: string) {
    setContent(prev => prev + '\n' + variable + '\n')
    setEditorKey(k => k + 1)
    toast.success(`已插入变量：${variable}`)
  }

  async function handleTemplateChange(templateId: string, date?: Date) {
    const renderDate = date ?? baseDate
    const renderKey = `${templateId}@${renderDate.toISOString()}`
    latestRenderRef.current = renderKey

    setSelectedTemplateId(templateId)

    try {
      const response = await fetch(
        `/api/templates/${templateId}/render?date=${renderDate.toISOString()}`
      )

      // 忽略过期请求的响应，避免竞态导致编辑器显示旧数据
      if (latestRenderRef.current !== renderKey) {
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || '模板加载失败')
        return
      }

      const data = await response.json()
      setContent(data.content)
      setEditorKey(k => k + 1)
    } catch (error) {
      // 仅对最新请求显示错误提示
      if (latestRenderRef.current === renderKey) {
        toast.error('模板预览失败，请重试')
      }
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
          <Button type="button" variant="outline" size="icon" onClick={goToPrevWeek} aria-label="上一周">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-medium">
            {year}年第{weekNumber}周 ({weekStart} ~ {weekEnd})
          </div>
          <Button type="button" variant="outline" size="icon" onClick={goToNextWeek} aria-label="下一周">
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
            <Label>模板</Label>
            <TemplateSelect
              officialTemplates={officialTemplates}
              userTemplates={userTemplates}
              value={selectedTemplateId}
              onChange={handleTemplateChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label>内容</Label>
              <VariableToolbar onInsertVariable={handleInsertVariable} />
            </div>
            <MilkdownEditor key={editorKey} value={content} onChange={setContent} />
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