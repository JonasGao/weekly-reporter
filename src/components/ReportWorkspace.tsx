'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Bot, Briefcase, CheckCircle2, CircleAlert, Download, FileText, LayoutTemplate, LoaderCircle, RefreshCw, Save, Sparkles, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
  summary: string[]
  templateId: string
  templateName: string
  templateContent: string
  aiStyle: string
  sourceRevision: number
}

interface GenerationRun {
  status: 'generating' | 'completed' | 'failed'
  variantLabel: string
  templateName: string
  templateContent: string
  styleLabel: string
  sourceDraft: string
  error?: string
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

function GenerationConversation({
  run,
  preview,
  busy,
  hasFinal,
  onAccept,
  onCancel,
  onRetry,
}: {
  run: GenerationRun
  preview: GenerationPreview | null
  busy: string | null
  hasFinal: boolean
  onAccept: () => void
  onCancel: () => void
  onRetry: () => void
}) {
  return (
    <div className="space-y-5 rounded-xl border border-border bg-muted/10 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" />AI 生成对话</h2>
        <span className="text-xs text-muted-foreground">{run.variantLabel}</span>
      </div>

      <div className="flex justify-end gap-3">
        <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
          使用“{run.templateName}”和“{run.styleLabel}”生成本次周报终版。
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="h-4 w-4" />
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-4 rounded-2xl rounded-tl-sm border border-border bg-background p-4">
          <div>
            <p className="font-medium">本次输入上下文</p>
            <p className="mt-1 text-xs text-muted-foreground">已锁定当前受众版本的原稿、模板和写作风格。</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <details className="rounded-lg border border-border bg-muted/20 p-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />查看原稿
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{run.sourceDraft}</pre>
            </details>
            <details className="rounded-lg border border-border bg-muted/20 p-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                <LayoutTemplate className="h-4 w-4" />查看模板
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{run.templateContent}</pre>
            </details>
          </div>

          {run.status === 'generating' && (
            <div role="status" className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />原稿、模板和风格已提交</p>
              <p className="flex items-center gap-2 text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />AI 正在整理事实并生成候选终版...</p>
            </div>
          )}

          {run.status === 'failed' && (
            <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <p className="flex items-center gap-2"><CircleAlert className="h-4 w-4" />{run.error ?? '终版生成失败'}</p>
              <Button variant="outline" size="sm" onClick={onRetry} disabled={busy !== null}>重新生成</Button>
            </div>
          )}

          {run.status === 'completed' && preview && (
            <>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-2 text-sm font-medium">处理摘要</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {(preview.summary.length > 0 ? preview.summary : ['已依据原稿事实和所选模板生成候选终版。']).map((item, index) => (
                    <li key={`${index}-${item}`} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-3 text-sm font-medium">候选终版</p>
                <div className="rounded-lg border border-border bg-[#141414] p-5 prose prose-invert prose-report max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.content}</ReactMarkdown>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy !== null}>取消</Button>
        {preview && <Button onClick={onAccept} disabled={busy !== null}><Save className="mr-1.5 h-4 w-4" />{hasFinal ? '替换当前终版' : '采用此版本'}</Button>}
      </div>
    </div>
  )
}

export function ReportWorkspace({ reportId, editable = true }: { reportId: number; editable?: boolean }) {
  const router = useRouter()
  const [bundle, setBundle] = useState<ReportBundle | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [styles, setStyles] = useState<StyleOption[]>([])
  const [variant, setVariant] = useState<AudienceVariant>('personal')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState<GenerationPreview | null>(null)
  const [generationRun, setGenerationRun] = useState<GenerationRun | null>(null)
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
    setGenerationRun(null)
    setEditorKey((key) => key + 1)
  }

  async function generate() {
    if (!templateId) {
      toast.error('请选择模板')
      return
    }
    const selectedTemplate = templates.find((item) => item.id === templateId)
    if (!selectedTemplate) {
      toast.error('模板不存在')
      return
    }
    const effectiveStyleKey = styleOverride || selectedTemplate.aiStyle || ''
    const effectiveStyle = styles.find((item) => item.key === effectiveStyleKey)
    setPreview(null)
    setGenerationRun({
      status: 'generating',
      variantLabel: variantLabels[variant],
      templateName: selectedTemplate.name,
      templateContent: selectedTemplate.content,
      styleLabel: effectiveStyle?.label ?? (effectiveStyleKey || '模板默认风格'),
      sourceDraft: currentVariant?.sourceDraft ?? '',
    })
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
        summary: Array.isArray(data.summary) ? data.summary : [],
        templateId: data.template.id,
        templateName: data.template.name,
        templateContent: data.template.content,
        aiStyle: data.aiStyle,
        sourceRevision: data.sourceRevision,
      })
      setGenerationRun((current) => current ? { ...current, status: 'completed' } : current)
      toast.success('生成预览已就绪')
    } catch (error) {
      const message = error instanceof Error ? error.message : '终版生成失败'
      setGenerationRun((current) => current ? { ...current, status: 'failed', error: message } : current)
      toast.error(message)
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
      setGenerationRun(null)
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
      setGenerationRun(null)
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
    <main className="container mx-auto max-w-7xl px-4 py-8">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          {generationRun ? (
            <GenerationConversation
              run={generationRun}
              preview={preview}
              busy={busy}
              hasFinal={hasFinal}
              onAccept={acceptPreview}
              onCancel={() => { setPreview(null); setGenerationRun(null) }}
              onRetry={generate}
            />
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

          {editable && !hasFinal && !generationRun && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">当前版本只有原稿。选择模板并生成终版后即可编辑。</div>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          {editable && <div className="rounded-xl border border-border p-4 space-y-4">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" />生成终版</div>
            <div className="space-y-2"><Label htmlFor="template">模板</Label><select id="template" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={templateId} onChange={(event) => { setTemplateId(event.target.value); const selected = templates.find((item) => item.id === event.target.value); setStyleOverride(selected?.aiStyle ?? '') }}><option value="">请选择模板</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="style">AI 风格</Label><select id="style" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={styleOverride} onChange={(event) => setStyleOverride(event.target.value)}><option value="">使用模板默认风格</option>{styles.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
            <Button className="w-full" onClick={generate} disabled={busy !== null || !templateId || currentVariant.sourceRevision === 0 || currentVariant.sourceDraft === '- 本周暂无事件'}>{busy === 'generate' ? '生成中...' : generationRun ? '重新生成' : '开始生成'}</Button>
            {(currentVariant.sourceRevision === 0 || currentVariant.sourceDraft === '- 本周暂无事件') && <p className="text-xs text-muted-foreground">本版本没有可用原稿，暂不能生成终版。</p>}
          </div>}

          {hasFinal && <ScoreCard report={scoreShape(currentVariant)} />}
          <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">原稿</p>
            <div data-testid="source-draft-scroll" className="max-h-[min(52vh,520px)] overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 pr-2 prose prose-sm dark:prose-invert prose-report max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentVariant.sourceDraft}</ReactMarkdown>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
