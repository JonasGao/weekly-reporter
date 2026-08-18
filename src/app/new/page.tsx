'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addWeeks, getWeek, getYear, subWeeks } from 'date-fns'
import { ArrowLeft, Briefcase, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getWeekRange, formatDate } from '@/lib/utils'

type AudienceVariant = 'leadership' | 'personal'
type PreviewVariant = { variant: AudienceVariant; sourceDraft: string }

const variantLabels: Record<AudienceVariant, string> = {
  leadership: '领导版',
  personal: '个人版',
}

export default function NewReportPage() {
  const router = useRouter()
  const [baseDate, setBaseDate] = useState(new Date())
  const [preview, setPreview] = useState<PreviewVariant[] | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewRequestVersion, setPreviewRequestVersion] = useState(0)
  const [previewVariant, setPreviewVariant] = useState<AudienceVariant>('leadership')
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
    setPreview(null)
    setPreviewError(null)
    setPreviewVariant('leadership')
  }

  useEffect(() => {
    const controller = new AbortController()

    async function loadPreview() {
      try {
        const response = await fetch('/api/reports/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekStart, weekEnd }),
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || '预览失败')
        }
        if (!controller.signal.aborted) {
          setPreview(data.variants as PreviewVariant[])
          setPreviewVariant('leadership')
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewError(error instanceof Error ? error.message : '预览失败，请重试')
        }
      }
    }

    void loadPreview()
    return () => controller.abort()
  }, [weekStart, weekEnd, previewRequestVersion])

  function refreshPreview() {
    setPreview(null)
    setPreviewError(null)
    setPreviewRequestVersion((version) => version + 1)
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error('请填写标题')
      return
    }
    if (!preview) {
      toast.error('原稿预览尚未完成')
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

  const activePreview = preview?.find((item) => item.variant === previewVariant)?.sourceDraft ?? ''
  const previewing = preview === null && previewError === null

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="返回">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">新建周报</h1>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="outline" size="icon" onClick={() => changeWeek(subWeeks(baseDate, 1))} disabled={previewing || saving} aria-label="上一周">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center text-lg font-medium">
            {year}年第{weekNumber}周 ({weekStart} ~ {weekEnd})
          </div>
          <Button type="button" variant="outline" size="icon" onClick={() => changeWeek(addWeeks(baseDate, 1))} disabled={previewing || saving} aria-label="下一周">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={saving} />
        </div>

        <section aria-label="原稿预览" className="space-y-4 rounded-lg border border-border p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">原稿预览（只读）</h2>
            {preview && (
              <Button type="button" variant="outline" onClick={refreshPreview} disabled={saving}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                刷新
              </Button>
            )}
          </div>
          {previewing ? (
            <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              正在加载原稿...
            </div>
          ) : previewError ? (
            <div role="alert" className="flex min-h-56 flex-col items-center justify-center gap-3 text-sm text-destructive">
              <p>{previewError}</p>
              <Button type="button" variant="outline" onClick={refreshPreview} disabled={saving}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                重试
              </Button>
            </div>
          ) : preview ? (
            <Tabs value={previewVariant} onValueChange={(value) => setPreviewVariant(value as AudienceVariant)}>
              <TabsList className="w-full">
                <TabsTrigger value="leadership"><Briefcase className="h-4 w-4" />{variantLabels.leadership}</TabsTrigger>
                <TabsTrigger value="personal"><User className="h-4 w-4" />{variantLabels.personal}</TabsTrigger>
              </TabsList>
              <TabsContent value={previewVariant} className="mt-4">
                <div className="min-h-56 rounded-lg border border-border bg-muted/20 p-5 prose-report">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activePreview}</ReactMarkdown>
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
        </section>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={previewing || saving}>取消</Button>
          <Button type="button" onClick={handleSave} disabled={previewing || saving || !preview}>
            {saving ? '创建中...' : '创建'}
          </Button>
        </div>
      </div>
    </main>
  )
}
