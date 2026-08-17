'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Briefcase, Download, RefreshCw, Save, Sparkles, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { ScoreCard } from '@/components/ScoreCard'
import type { AudienceVariant, Report, ReportVariant } from '@/lib/db/schema'

interface TemplateOption {
  id: string
  name: string
  content: string
  aiStyle?: string
}

interface StyleOption {
  key: string
  label: string
}

interface ReportBundle extends Report {
  variants: ReportVariant[]
  snapshots: unknown[]
}

interface GenerationPreview {
  content: string
  templateId: string
  templateName: string
  templateContent: string
  aiStyle: string
  sourceRevision: number
}

function normalizeBundle(data: Partial<ReportBundle> & { id: number; content?: string }): ReportBundle {
  const legacyVariant: ReportVariant = {
    id: -data.id,
    reportId: data.id,
    variant: 'personal',
    sourceDraft: '- 本周暂无事件',
    finalContent: data.content ?? null,
    finalStatus: data.content ? 'current' : 'none',
    templateId: null,
    templateName: null,
    templateContent: null,
    aiStyle: null,
    sourceRevision: 0,
    scoreStatus: data.scoreStatus ?? 'completed',
    scoreStructure: data.scoreStructure ?? null,
    scoreContent: data.scoreContent ?? null,
    scoreValue: data.scoreValue ?? null,
    scoreOverall: data.scoreOverall ?? null,
    suggestions: data.suggestions ?? null,
    scoreError: data.scoreError ?? null,
    scoredAt: data.scoredAt ?? null,
    createdAt: data.createdAt ?? new Date(),
    updatedAt: data.updatedAt ?? new Date(),
  }
  return { ...data, variants: data.variants?.length ? data.variants : [legacyVariant], snapshots: data.snapshots ?? [] } as ReportBundle
}

const variantLabels: Record<AudienceVariant, string> = {
  personal: '个人版',
  leadership: '领导版',
}

export function ReportWorkspace({ reportId, editable = true }: { reportId: number; editable?: boolean }) {
  const router = useRouter()
  const [bundle, setBundle] = useState<ReportBundle | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [styles, setStyles] = useState<StyleOption[]>([])
  const [variant, setVariant] = useState<AudienceVariant>('personal')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState<GenerationPreview | null>(null)
  const [templateId, setTemplateId] = useState('')
  const [styleOverride, setStyleOverride] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)

  const currentVariant = useMemo(
    () => bundle?.variants.find((item) => item.variant === variant) ?? null,
    [bundle, variant],
  )
  const hasFinal = Boolean(currentVariant?.finalContent)
  const sourceContent = currentVariant?.finalContent ?? currentVariant?.sourceDraft ?? ''
  const displayContent = preview?.content ?? (hasFinal ? content : sourceContent)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [reportResponse, templateResponse, styleResponse] = await Promise.all([
          fetch(`/api/reports/${reportId}`),
          fetch('/api/templates'),
          fetch('/api/prompts/styles'),
        ])
        if (!reportResponse.ok) throw new Error('周报不存在')
        const reportData = await reportResponse.json()
        const templateData = await templateResponse.json()
        const styleData = await styleResponse.json()
        if (cancelled) return

        const allTemplates = [
          ...(templateData.official ?? []),
          ...(templateData.user ?? []).map((item: { id: number; name: string; content: string; aiStyle?: string }) => ({
            ...item,
            id: `user-${item.id}`,
          })),
        ]
        const normalized = normalizeBundle(reportData)
        const initialVariant = normalized.variants.find((item) => item.variant === 'personal')
          ?? normalized.variants[0]
        setBundle(normalized)
        if (initialVariant) setVariant(initialVariant.variant)
        setContent(initialVariant?.finalContent ?? initialVariant?.sourceDraft ?? '')
        setTemplates(allTemplates)
        setStyles((styleData.styles ?? []).map((item: { key: string; label: string }) => ({ key: item.key, label: item.label })))
        if (allTemplates[0]) {
          setTemplateId(allTemplates[0].id)
          setStyleOverride(allTemplates[0].aiStyle ?? '')
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '加载周报失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [reportId])

  function scoreShape(item: ReportVariant): Report {
    return {
      ...(bundle as Report),
      content: item.finalContent ?? item.sourceDraft,
      scoreStatus: item.scoreStatus,
      scoreStructure: item.scoreStructure,
      scoreContent: item.scoreContent,
      scoreValue: item.scoreValue,
      scoreOverall: item.scoreOverall,
      suggestions: item.suggestions,
      scoreError: item.scoreError,
      scoredAt: item.scoredAt,
    }
  }

  function selectVariant(nextVariant: AudienceVariant) {
    const next = bundle?.variants.find((item) => item.variant === nextVariant)
    if (!next) return
    setVariant(nextVariant)
    setContent(next?.finalContent ?? next?.sourceDraft ?? '')
    setPreview(null)
    setEditorKey((key) => key + 1)
  }

  async function generate() {
    if (!templateId) {
      toast.error('请选择模板')
      return
    }
    setBusy('generate')
    try {
      const response = await fetch(`/api/reports/${reportId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant, templateId, styleOverride: styleOverride || undefined }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '生成失败')
      setPreview({
        content: data.content,
        templateId: data.template.id,
        templateName: data.template.name,
        templateContent: data.template.content,
        aiStyle: data.aiStyle,
        sourceRevision: data.sourceRevision,
      })
      toast.success('生成预览已就绪')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '终版生成失败')
    } finally {
      setBusy(null)
    }
  }

  async function acceptPreview() {
    if (!preview) return
    if (hasFinal && !confirm('采用此预览会覆盖当前终版，确定继续吗？')) return
    setBusy('accept')
    try {
      const response = await fetch(`/api/reports/${reportId}/final`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant, ...preview }),
      })
      const updated = await response.json()
      if (!response.ok) throw new Error(updated.error || '保存终版失败')
      setBundle((current) => current ? {
        ...current,
        variants: current.variants.map((item) => item.id === updated.id ? updated : item),
      } : current)
      setContent(updated.finalContent)
      setPreview(null)
      setEditorKey((key) => key + 1)
      toast.success('终版已保存，评分将在后台进行')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存终版失败')
    } finally {
      setBusy(null)
    }
  }

  async function saveEditedFinal() {
    if (!currentVariant?.finalContent || !content.trim()) return
    setBusy('save')
    try {
      const response = await fetch(`/api/reports/${reportId}/final`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant,
          content,
          templateId: currentVariant.templateId,
          templateName: currentVariant.templateName,
          templateContent: currentVariant.templateContent,
          aiStyle: currentVariant.aiStyle,
          sourceRevision: currentVariant.sourceRevision,
        }),
      })
      const updated = await response.json()
      if (!response.ok) throw new Error(updated.error || '保存失败')
      setBundle((current) => current ? {
        ...current,
        variants: current.variants.map((item) => item.id === updated.id ? updated : item),
      } : current)
      toast.success('终版已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setBusy(null)
    }
  }

  async function regenerateSources() {
    if (!confirm('重新生成原稿会使现有终版标记为过期，确定继续吗？')) return
    setBusy('regenerate')
    try {
      const response = await fetch(`/api/reports/${reportId}/regenerate-source`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '重新生成原稿失败')
      const normalized = normalizeBundle(data)
      const next = normalized.variants.find((item) => item.variant === variant)
      setBundle(normalized)
      setContent(next?.finalContent ?? next?.sourceDraft ?? '')
      setPreview(null)
      setEditorKey((key) => key + 1)
      toast.success('两份原稿已更新')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重新生成原稿失败')
    } finally {
      setBusy(null)
    }
  }

  function exportCurrent() {
    const blob = new Blob([displayContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `周报-${variantLabels[variant]}-${bundle?.weekStart ?? ''}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function deleteReport() {
    if (!confirm('确定要删除这篇周报吗？')) return
    setBusy('delete')
    try {
      const response = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('删除失败')
      toast.success('周报已删除')
      router.push('/reports')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="text-center py-12">加载中...</div>
  if (!bundle || !currentVariant) return <div className="text-center py-12">周报不存在</div>

  return (
    <main className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-start justify-between gap-4 mb-6 max-[720px]:flex-col">
        <div className="flex items-start gap-3">
          <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{bundle.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{bundle.weekStart} - {bundle.weekEnd}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCurrent}><Download className="h-4 w-4 mr-1.5" />导出</Button>
          {editable && <Button variant="outline" onClick={regenerateSources} disabled={busy !== null}><RefreshCw className="h-4 w-4 mr-1.5" />重新生成原稿</Button>}
          {!editable && <Link href={`/edit/${reportId}`}><Button>编辑</Button></Link>}
          {!editable && <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={deleteReport} disabled={busy !== null}><Trash2 className="h-4 w-4 mr-1.5" />删除</Button>}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['leadership', 'personal'] as AudienceVariant[]).map((item) => {
          const available = bundle.variants.some((candidate) => candidate.variant === item)
          return <Button key={item} variant={variant === item ? 'default' : 'outline'} onClick={() => selectVariant(item)} disabled={!available} title={available ? undefined : '旧版周报没有此受众版本'}>
            {item === 'leadership' ? <Briefcase className="h-4 w-4 mr-1.5" /> : <User className="h-4 w-4 mr-1.5" />}
            {variantLabels[item]}
          </Button>
        })}
        <span className="text-sm text-muted-foreground self-center ml-2">
          {hasFinal ? (currentVariant.finalStatus === 'stale' ? '终版已过期' : '已有终版') : '仅有原稿'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <section className="space-y-4">
          {preview ? (
            <div className="rounded-xl border border-primary/50 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">生成预览</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPreview(null)}>取消</Button>
                  <Button onClick={acceptPreview} disabled={busy !== null}><Save className="h-4 w-4 mr-1.5" />采用此版本</Button>
                </div>
              </div>
              <div className="bg-background rounded-lg p-5 prose prose-invert prose-report max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.content}</ReactMarkdown>
              </div>
            </div>
          ) : editable && hasFinal ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label>终版内容</Label><Button size="sm" onClick={saveEditedFinal} disabled={busy !== null}><Save className="h-4 w-4 mr-1.5" />保存</Button></div>
              <MilkdownEditor key={editorKey} value={content} onChange={setContent} />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-[#141414] p-6 prose prose-invert prose-report max-w-none">
              <div className="flex items-center justify-between mb-4 not-prose"><Label>{hasFinal ? '终版内容' : '周报原稿（只读）'}</Label>{hasFinal && currentVariant.finalStatus === 'stale' && <span className="text-xs text-amber-400">原稿已更新，终版过期</span>}</div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
            </div>
          )}

          {editable && !hasFinal && !preview && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">当前版本只有原稿。选择模板并生成终版后即可编辑。</div>
          )}
        </section>

        <aside className="space-y-4">
          {editable && <div className="rounded-xl border border-border p-4 space-y-4">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" />生成终版</div>
            <div className="space-y-2"><Label htmlFor="template">模板</Label><select id="template" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={templateId} onChange={(event) => { setTemplateId(event.target.value); const selected = templates.find((item) => item.id === event.target.value); setStyleOverride(selected?.aiStyle ?? '') }}><option value="">请选择模板</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="style">AI 风格</Label><select id="style" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={styleOverride} onChange={(event) => setStyleOverride(event.target.value)}><option value="">使用模板默认风格</option>{styles.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
            <Button className="w-full" onClick={generate} disabled={busy !== null || !templateId || currentVariant.sourceRevision === 0 || currentVariant.sourceDraft === '- 本周暂无事件'}>{busy === 'generate' ? '生成中...' : '生成预览'}</Button>
            {(currentVariant.sourceRevision === 0 || currentVariant.sourceDraft === '- 本周暂无事件') && <p className="text-xs text-muted-foreground">本版本没有可用原稿，暂不能生成终版。</p>}
          </div>}

          {hasFinal && <ScoreCard report={scoreShape(currentVariant)} />}
          <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground"><p className="font-medium text-foreground mb-2">原稿</p><Textarea value={currentVariant.sourceDraft} readOnly className="min-h-[180px] text-xs font-mono" /></div>
        </aside>
      </div>
    </main>
  )
}
