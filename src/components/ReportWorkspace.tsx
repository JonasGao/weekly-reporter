'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Briefcase, Download, FileText, MessageSquareText, RefreshCw, Save, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { GenerationWorkspace } from '@/components/GenerationWorkspace'
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
    acceptedProposalId: null,
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
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [workspaceMode, setWorkspaceMode] = useState<'content' | 'ai'>(editable ? 'ai' : 'content')

  const currentVariant = useMemo(
    () => bundle?.variants.find((item) => item.variant === variant) ?? null,
    [bundle, variant],
  )
  const hasFinal = Boolean(currentVariant?.finalContent)
  const displayContent = currentVariant?.finalContent ?? currentVariant?.sourceDraft ?? ''

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
        const initialVariant = normalized.variants.find((item) => item.variant === 'personal') ?? normalized.variants[0]
        setBundle(normalized)
        if (initialVariant) setVariant(initialVariant.variant)
        setContent(initialVariant?.finalContent ?? initialVariant?.sourceDraft ?? '')
        setTemplates(allTemplates)
        setStyles((styleData.styles ?? []).map((item: { key: string; label: string }) => ({ key: item.key, label: item.label })))
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
    setContent(next.finalContent ?? next.sourceDraft ?? '')
    setEditorKey((key) => key + 1)
  }

  function acceptGeneratedVariant(updated: ReportVariant) {
    setBundle((current) => current ? {
      ...current,
      variants: current.variants.map((item) => item.id === updated.id ? updated : item),
    } : current)
    setContent(updated.finalContent ?? updated.sourceDraft)
    setEditorKey((key) => key + 1)
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
      acceptGeneratedVariant(updated)
      toast.success('终版已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setBusy(null)
    }
  }

  async function regenerateSources() {
    if (!confirm('重新生成原稿会使现有终版和旧 AI 会话基线过期，确定继续吗？')) return
    setBusy('regenerate')
    try {
      const response = await fetch(`/api/reports/${reportId}/regenerate-source`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '重新生成原稿失败')
      const normalized = normalizeBundle(data)
      const next = normalized.variants.find((item) => item.variant === variant)
      setBundle(normalized)
      setContent(next?.finalContent ?? next?.sourceDraft ?? '')
      setEditorKey((key) => key + 1)
      toast.success('两份原稿已更新；请创建新的 AI 会话')
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
    if (!confirm('确定要删除这篇周报吗？相关 AI 会话、消息和候选记录也会删除。')) return
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

  if (loading) return <div className="py-12 text-center">加载中...</div>
  if (!bundle || !currentVariant) return <div className="py-12 text-center">周报不存在</div>

  return (
    <main className="container mx-auto max-w-[1500px] px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4 max-[720px]:flex-col">
        <div className="flex items-start gap-3">
          <Link href="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div><h1 className="text-2xl font-bold">{bundle.title}</h1><p className="mt-1 text-sm text-muted-foreground">{bundle.weekStart} - {bundle.weekEnd}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCurrent}><Download className="mr-1.5 h-4 w-4" />导出</Button>
          {editable && <Button variant="outline" onClick={() => void regenerateSources()} disabled={busy !== null}><RefreshCw className="mr-1.5 h-4 w-4" />重新生成原稿</Button>}
          {!editable && <Link href={`/edit/${reportId}`}><Button>编辑</Button></Link>}
          {!editable && <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => void deleteReport()} disabled={busy !== null}><Trash2 className="mr-1.5 h-4 w-4" />删除</Button>}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['leadership', 'personal'] as AudienceVariant[]).map((item) => {
            const available = bundle.variants.some((candidate) => candidate.variant === item)
            return <Button key={item} variant={variant === item ? 'default' : 'outline'} onClick={() => selectVariant(item)} disabled={!available} title={available ? undefined : '旧版周报没有此受众版本'}>
              {item === 'leadership' ? <Briefcase className="mr-1.5 h-4 w-4" /> : <User className="mr-1.5 h-4 w-4" />}{variantLabels[item]}
            </Button>
          })}
          <span className="ml-2 self-center text-sm text-muted-foreground">{hasFinal ? (currentVariant.finalStatus === 'stale' ? '终版已过期' : '已有终版') : '仅有原稿'}</span>
        </div>
        <div className="flex rounded-lg bg-muted p-1">
          <button type="button" onClick={() => setWorkspaceMode('content')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${workspaceMode === 'content' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}><FileText className="h-4 w-4" />周报内容</button>
          <button type="button" onClick={() => setWorkspaceMode('ai')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${workspaceMode === 'ai' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}><MessageSquareText className="h-4 w-4" />AI 对话</button>
        </div>
      </div>

      {workspaceMode === 'ai' ? (
        <GenerationWorkspace
          key={`${reportId}-${variant}-${currentVariant.sourceRevision}`}
          reportId={reportId}
          variant={variant}
          reportVariant={currentVariant}
          templates={templates}
          styles={styles}
          editable={editable}
          onAccepted={acceptGeneratedVariant}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 space-y-4">
            {editable && hasFinal ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label>终版内容</Label><Button size="sm" onClick={() => void saveEditedFinal()} disabled={busy !== null}><Save className="mr-1.5 h-4 w-4" />保存</Button></div>
                <MilkdownEditor key={editorKey} value={content} onChange={setContent} />
              </div>
            ) : (
              <div className={`rounded-xl border border-border p-6 prose prose-report max-w-none ${editable ? 'bg-[#141414] prose-invert' : 'report-view-content bg-card text-card-foreground'}`}>
                <div className="not-prose mb-4 flex items-center justify-between"><Label>{hasFinal ? '终版内容' : '周报原稿（只读）'}</Label>{hasFinal && currentVariant.finalStatus === 'stale' && <span className="text-xs text-amber-400">原稿已更新，终版过期</span>}</div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
              </div>
            )}
            {editable && !hasFinal && <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">当前版本只有原稿。切换到“AI 对话”，创建会话并让 AI 提交候选终版。</div>}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {hasFinal && <ScoreCard report={scoreShape(currentVariant)} />}
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">原稿</p>
              <div data-testid="source-draft-scroll" className="max-h-[min(42vh,440px)] overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 pr-2 prose prose-sm dark:prose-invert prose-report max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentVariant.sourceDraft}</ReactMarkdown>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
