'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Archive,
  Bot,
  Check,
  Clipboard,
  Code2,
  Eye,
  FileDiff,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Square,
  User,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_GENERATION_INSTRUCTION } from '@/lib/generation/context'
import {
  appendRevealedMarkdown,
  finalizeStreamingMarkdown,
  type StreamingMarkdown,
} from '@/lib/generation/streaming-markdown'
import type { AudienceVariant, ReportVariant } from '@/lib/db/schema'

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

interface SessionSummary {
  id: number
  title: string
  status: 'active' | 'archived'
  variant: AudienceVariant
  sourceRevision: number
  templateName: string
  aiStyleLabel: string
  updatedAt: string
  latestTurn: { status: string } | null
  latestProposal: Proposal | null
}

interface MessagePart {
  id: number
  turnId: number | null
  sequence: number
  role: 'system' | 'user' | 'assistant' | 'tool' | 'application'
  partType: string
  content: string | null
  data: Record<string, unknown> | null
}

interface Turn {
  id: number
  status: 'working' | 'completed' | 'failed' | 'aborted'
  protocol: string
  model: string
  error: string | null
  createdAt: string
}

interface Proposal {
  id: number
  turnId: number
  content: string
  summary: string[]
  sourceRevision: number
  status: 'pending' | 'accepted' | 'superseded'
  createdAt: string | Date
  acceptedAt?: string | Date | null
}

interface SessionDetail extends SessionSummary {
  sourceDraftSnapshot: string
  sourceOverview: string
  templateId: string
  templateContent: string
  aiStyleKey: string
  aiStylePrompt: string
  systemPrompt: string
  toolRules: string
  baselineFinalContent: string | null
  messages: MessagePart[]
  turns: Turn[]
  proposals: Proposal[]
  sourceIsCurrent: boolean
  activeTurn: Turn | null
}

type StreamEvent =
  | { type: 'start'; turnId: number; protocol: string; model: string }
  | { type: 'working'; label: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-input-delta'; toolName: string }
  | { type: 'tool-call'; toolName: string; toolCallId: string }
  | { type: 'tool-result'; toolName: string; toolCallId: string }
  | { type: 'proposal'; proposal: Proposal }
  | { type: 'finish'; status: 'completed' | 'aborted' }
  | { type: 'error'; message: string }

type ReviewTab = 'preview' | 'source' | 'diff'

interface DiffLine {
  type: 'same' | 'add' | 'remove'
  value: string
}

const REVEAL_INTERVAL_MS = 50
const REVEAL_CHARACTERS_PER_SECOND = 160
const FOLLOW_BOTTOM_THRESHOLD = 64

function emptyStreamingMarkdown(): StreamingMarkdown {
  return { markdownBlocks: [], pendingChunks: [] }
}

function takeCharacters(value: string, count: number): [string, string] {
  let end = 0
  let taken = 0
  for (const character of value) {
    if (taken === count) break
    end += character.length
    taken += 1
  }
  return [value.slice(0, end), value.slice(end)]
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function lineDiff(before: string, after: string): DiffLine[] {
  const left = before.split('\n')
  const right = after.split('\n')
  if (left.length * right.length > 160_000) {
    return [
      ...left.map((value) => ({ type: 'remove' as const, value })),
      ...right.map((value) => ({ type: 'add' as const, value })),
    ]
  }
  const table = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1))
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const output: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      output.push({ type: 'same', value: left[i] })
      i += 1
      j += 1
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      output.push({ type: 'remove', value: left[i] })
      i += 1
    } else {
      output.push({ type: 'add', value: right[j] })
      j += 1
    }
  }
  while (i < left.length) output.push({ type: 'remove', value: left[i++] })
  while (j < right.length) output.push({ type: 'add', value: right[j++] })
  return output
}

function SystemContextCard({ detail }: { detail: SessionDetail }) {
  const blocks = [
    ['终版生成系统提示词', detail.systemPrompt],
    [`AI 风格提示词 · ${detail.aiStyleLabel}`, detail.aiStylePrompt],
    ['工具规则', detail.toolRules],
  ] as const
  async function copy(value: string) {
    await navigator.clipboard.writeText(value)
    toast.success('已复制')
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/15 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bot className="h-4 w-4" />应用 System 消息</div>
      <div className="space-y-2">
        {blocks.map(([label, content]) => (
          <details key={label} className="rounded-lg border border-border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">{label}</summary>
            <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={() => void copy(content)}><Clipboard className="mr-1.5 h-3.5 w-3.5" />复制</Button></div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{content}</pre>
          </details>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">原稿概览</p>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" size="sm" />}><FileText className="mr-1.5 h-3.5 w-3.5" />检查完整原稿</DialogTrigger>
            <DialogContent className="max-h-[88vh] sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>会话使用的完整原稿</DialogTitle>
                <DialogDescription>这是发送给 AI 的不可变原稿快照，也是本会话唯一的事实来源。</DialogDescription>
              </DialogHeader>
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-4 text-sm leading-6">{detail.sourceDraftSnapshot}</pre>
            </DialogContent>
          </Dialog>
        </div>
        <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{detail.sourceOverview}</pre>
      </div>
      <details className="mt-2 rounded-lg border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">模板快照 · {detail.templateName}</summary>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{detail.templateContent}</pre>
      </details>
    </div>
  )
}

function TranscriptPart({ part }: { part: MessagePart }) {
  if (part.role === 'system' || part.partType === 'status') return null
  if (part.role === 'user') {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">{part.content}</div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><User className="h-4 w-4" /></div>
      </div>
    )
  }
  if (part.partType === 'reasoning') {
    return (
      <div className="ml-11 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
        <p className="mb-2 text-xs font-medium text-violet-400">供应商返回的 reasoning / thinking</p>
        <div className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{part.content}</div>
      </div>
    )
  }
  if (part.partType === 'tool-call' || part.partType === 'tool-result') {
    return (
      <div className="ml-11 flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        <Wrench className="h-4 w-4" />{part.content}
      </div>
    )
  }
  if (part.partType === 'proposal-accepted') {
    return <div className="text-center text-xs text-emerald-500"><Check className="mr-1 inline h-3.5 w-3.5" />{part.content}</div>
  }
  if (part.partType === 'error') {
    return <div className="ml-11 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{part.content}</div>
  }
  if (part.role === 'assistant') {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background"><Bot className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-border bg-background px-4 py-3 prose dark:prose-invert prose-report max-w-none text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content ?? ''}</ReactMarkdown>
        </div>
      </div>
    )
  }
  return null
}

const RenderedMarkdownBlock = memo(function RenderedMarkdownBlock({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
})

function LiveAssistant({ reasoning, text, toolState, working }: { reasoning: string; text: StreamingMarkdown; toolState: string; working: boolean }) {
  const hasText = text.markdownBlocks.length > 0 || text.pendingChunks.length > 0
  if (!working && !reasoning && !hasText && !toolState) return null
  return (
    <div className="space-y-3">
      {reasoning && (
        <div className="ml-11 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
          <p className="mb-2 text-xs font-medium text-violet-400">供应商返回的 reasoning / thinking</p>
          <div className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{reasoning}</div>
        </div>
      )}
      {(hasText || working) && (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background"><Bot className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-sm border border-border bg-background px-4 py-3">
            {hasText && (
              <div className="prose dark:prose-invert prose-report max-w-none text-sm">
                {text.markdownBlocks.map((block, index) => <RenderedMarkdownBlock key={index} content={block} />)}
                {text.pendingChunks.length > 0 && (
                  <div className="streaming-markdown-pending">
                    {text.pendingChunks.map((chunk) => <span key={chunk.id} className="streaming-text-reveal">{chunk.text}</span>)}
                  </div>
                )}
              </div>
            )}
            {working && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Working...</p>}
            {toolState && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Wrench className="h-3.5 w-3.5" />{toolState}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function ProposalReview({
  proposal,
  baseline,
  editable,
  accepting,
  onAccept,
}: {
  proposal: Proposal | null
  baseline: string | null
  editable: boolean
  accepting: boolean
  onAccept: () => void
}) {
  const [tab, setTab] = useState<ReviewTab>('preview')
  const diff = useMemo(() => proposal && baseline ? lineDiff(baseline, proposal.content) : [], [baseline, proposal])
  if (!proposal) {
    return (
      <aside className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        AI 调用 <code>propose_final_report</code> 后，候选终版会在这里出现。普通对话内容不会直接写入周报。
      </aside>
    )
  }

  return (
    <aside className="space-y-4 rounded-xl border border-border bg-background p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">候选终版</h3>
          <span className={`rounded-full px-2 py-1 text-xs ${proposal.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' : proposal.status === 'superseded' ? 'bg-muted text-muted-foreground' : 'bg-amber-500/10 text-amber-500'}`}>
            {proposal.status === 'accepted' ? '已采用' : proposal.status === 'superseded' ? '历史版本' : '待确认'}
          </span>
        </div>
        {proposal.summary.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{proposal.summary.map((item, index) => <li key={`${index}-${item}`}>• {item}</li>)}</ul>}
      </div>
      <div className="flex rounded-lg bg-muted p-1">
        {([
          ['preview', Eye, '预览'],
          ['source', Code2, '源码'],
          ['diff', FileDiff, 'Diff'],
        ] as const).map(([value, Icon, label]) => (
          <button key={value} type="button" onClick={() => setTab(value)} disabled={value === 'diff' && !baseline} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${tab === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'} disabled:opacity-40`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>
      {tab === 'preview' && <div className="rounded-lg border border-border bg-[#141414] p-4 prose prose-sm prose-invert prose-report max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{proposal.content}</ReactMarkdown></div>}
      {tab === 'source' && <pre className="max-h-[62vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-3 text-xs leading-5">{proposal.content}</pre>}
      {tab === 'diff' && baseline && (
        <pre className="max-h-[62vh] overflow-auto rounded-lg border border-border bg-muted/20 p-3 text-xs leading-5">
          {diff.map((line, index) => <div key={index} className={line.type === 'add' ? 'bg-emerald-500/10 text-emerald-500' : line.type === 'remove' ? 'bg-red-500/10 text-red-400' : 'text-muted-foreground'}>{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '} {line.value || ' '}</div>)}
        </pre>
      )}
      {editable && proposal.status === 'pending' && <Button className="w-full" onClick={onAccept} disabled={accepting}>{accepting ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}确认并保存终版</Button>}
      <p className="text-xs text-muted-foreground">确认前不会修改当前终版；保存后仍可继续在本会话中改进。</p>
    </aside>
  )
}

export function GenerationWorkspace({
  reportId,
  variant,
  reportVariant,
  templates,
  styles,
  editable,
  onAccepted,
}: {
  reportId: number
  variant: AudienceVariant
  reportVariant: ReportVariant
  templates: TemplateOption[]
  styles: StyleOption[]
  editable: boolean
  onAccepted: (variant: ReportVariant) => void
}) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [styleOverride, setStyleOverride] = useState(templates[0]?.aiStyle ?? '')
  const [composer, setComposer] = useState(DEFAULT_GENERATION_INSTRUCTION)
  const [streaming, setStreaming] = useState(false)
  const [liveTurnId, setLiveTurnId] = useState<number | null>(null)
  const [liveUser, setLiveUser] = useState('')
  const [liveReasoning, setLiveReasoning] = useState('')
  const [liveText, setLiveText] = useState<StreamingMarkdown>(emptyStreamingMarkdown)
  const [liveToolState, setLiveToolState] = useState('')
  const [liveProposal, setLiveProposal] = useState<Proposal | null>(null)
  const [accepting, setAccepting] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const textQueueRef = useRef('')
  const textRevealFrameRef = useRef<number | null>(null)
  const lastTextRevealAtRef = useRef(0)
  const nextTextChunkIdRef = useRef(0)
  const textQueueDrainedRef = useRef<(() => void) | null>(null)
  const reasoningQueueRef = useRef('')
  const reasoningFlushTimerRef = useRef<number | null>(null)
  const shouldFollowTranscriptRef = useRef(true)
  const transcriptFollowFrameRef = useRef<number | null>(null)
  const autoScrollTopRef = useRef<number | null>(null)
  const initiallyScrolledSessionRef = useRef<number | null>(null)

  const revealTextChunk = useCallback((text: string) => {
    const id = nextTextChunkIdRef.current
    nextTextChunkIdRef.current += 1
    setLiveText((current) => appendRevealedMarkdown(current, { id, text }))
  }, [])

  const scheduleTextReveal = useCallback(() => {
    if (textRevealFrameRef.current !== null) return

    const reveal = (now: number) => {
      textRevealFrameRef.current = null
      if (!textQueueRef.current) {
        const resolve = textQueueDrainedRef.current
        textQueueDrainedRef.current = null
        resolve?.()
        return
      }

      const elapsed = lastTextRevealAtRef.current === 0
        ? REVEAL_INTERVAL_MS
        : now - lastTextRevealAtRef.current
      if (elapsed < REVEAL_INTERVAL_MS) {
        textRevealFrameRef.current = requestAnimationFrame(reveal)
        return
      }

      const backlogMultiplier = textQueueRef.current.length > REVEAL_CHARACTERS_PER_SECOND * 2
        ? Math.min(4, 1 + textQueueRef.current.length / (REVEAL_CHARACTERS_PER_SECOND * 2))
        : 1
      const characterCount = Math.max(1, Math.round((elapsed / 1_000) * REVEAL_CHARACTERS_PER_SECOND * backlogMultiplier))
      const [visibleText, remainingText] = takeCharacters(textQueueRef.current, characterCount)
      textQueueRef.current = remainingText
      lastTextRevealAtRef.current = now
      revealTextChunk(visibleText)
      textRevealFrameRef.current = requestAnimationFrame(reveal)
    }

    textRevealFrameRef.current = requestAnimationFrame(reveal)
  }, [revealTextChunk])

  const queueLiveText = useCallback((text: string) => {
    textQueueRef.current += text
    scheduleTextReveal()
  }, [scheduleTextReveal])

  const waitForTextQueue = useCallback(async () => {
    if (!textQueueRef.current && textRevealFrameRef.current === null) return
    await new Promise<void>((resolve) => {
      textQueueDrainedRef.current = resolve
      scheduleTextReveal()
    })
  }, [scheduleTextReveal])

  const cancelTextReveal = useCallback(() => {
    if (textRevealFrameRef.current !== null) cancelAnimationFrame(textRevealFrameRef.current)
    textRevealFrameRef.current = null
    textQueueRef.current = ''
    lastTextRevealAtRef.current = 0
    const resolve = textQueueDrainedRef.current
    textQueueDrainedRef.current = null
    resolve?.()
  }, [])

  const flushLiveReasoning = useCallback(() => {
    if (reasoningFlushTimerRef.current !== null) clearTimeout(reasoningFlushTimerRef.current)
    reasoningFlushTimerRef.current = null
    const text = reasoningQueueRef.current
    reasoningQueueRef.current = ''
    if (text) setLiveReasoning((current) => current + text)
  }, [])

  const queueLiveReasoning = useCallback((text: string) => {
    reasoningQueueRef.current += text
    if (reasoningFlushTimerRef.current !== null) return
    reasoningFlushTimerRef.current = window.setTimeout(flushLiveReasoning, REVEAL_INTERVAL_MS)
  }, [flushLiveReasoning])

  const resetLiveOutput = useCallback(() => {
    cancelTextReveal()
    if (reasoningFlushTimerRef.current !== null) clearTimeout(reasoningFlushTimerRef.current)
    reasoningFlushTimerRef.current = null
    reasoningQueueRef.current = ''
    nextTextChunkIdRef.current = 0
    setLiveReasoning('')
    setLiveText(emptyStreamingMarkdown())
    setLiveToolState('')
  }, [cancelTextReveal])

  const cancelTranscriptFollow = useCallback(() => {
    if (transcriptFollowFrameRef.current !== null) cancelAnimationFrame(transcriptFollowFrameRef.current)
    transcriptFollowFrameRef.current = null
  }, [])

  const scheduleTranscriptFollow = useCallback(() => {
    if (!shouldFollowTranscriptRef.current || transcriptFollowFrameRef.current !== null) return

    const follow = () => {
      transcriptFollowFrameRef.current = null
      const transcript = transcriptRef.current
      if (!transcript || !shouldFollowTranscriptRef.current) return

      const target = Math.max(0, transcript.scrollHeight - transcript.clientHeight)
      const distance = target - transcript.scrollTop
      if (prefersReducedMotion() || Math.abs(distance) < 1) {
        autoScrollTopRef.current = target
        transcript.scrollTop = target
        return
      }

      const nextPosition = transcript.scrollTop + distance * 0.35
      autoScrollTopRef.current = nextPosition
      transcript.scrollTop = nextPosition
      transcriptFollowFrameRef.current = requestAnimationFrame(follow)
    }

    transcriptFollowFrameRef.current = requestAnimationFrame(follow)
  }, [])

  const handleTranscriptScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const transcript = event.currentTarget
    if (autoScrollTopRef.current !== null && Math.abs(transcript.scrollTop - autoScrollTopRef.current) < 1) return

    const distanceFromBottom = transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop
    shouldFollowTranscriptRef.current = distanceFromBottom <= FOLLOW_BOTTOM_THRESHOLD
    if (shouldFollowTranscriptRef.current) scheduleTranscriptFollow()
    else cancelTranscriptFollow()
  }, [cancelTranscriptFollow, scheduleTranscriptFollow])

  const loadSessions = useCallback(async (preferredId?: number) => {
    const response = await fetch(`/api/reports/${reportId}/generation-sessions?variant=${variant}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '加载生成会话失败')
    const rows = (data.sessions ?? []) as SessionSummary[]
    setSessions(rows)
    setActiveSessionId((current) => {
      if (preferredId && rows.some((item) => item.id === preferredId)) return preferredId
      if (current && rows.some((item) => item.id === current)) return current
      return rows[0]?.id ?? null
    })
  }, [reportId, variant])

  const loadDetail = useCallback(async (sessionId: number, settleLiveStream = false) => {
    const response = await fetch(`/api/reports/${reportId}/generation-sessions/${sessionId}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '加载会话失败')
    setDetail(data)
    setLiveProposal(null)
    if (settleLiveStream) {
      setLiveTurnId(null)
      setLiveUser('')
      resetLiveOutput()
    }
  }, [reportId, resetLiveOutput])

  useEffect(() => {
    let cancelled = false
    async function initializeSessions() {
      try {
        const response = await fetch(`/api/reports/${reportId}/generation-sessions?variant=${variant}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '加载生成会话失败')
        if (cancelled) return
        const rows = (data.sessions ?? []) as SessionSummary[]
        setSessions(rows)
        setActiveSessionId(rows[0]?.id ?? null)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : '加载生成会话失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initializeSessions()
    return () => { cancelled = true }
  }, [reportId, variant])

  useEffect(() => {
    if (!activeSessionId) return
    let cancelled = false
    async function fetchDetail() {
      try {
        const response = await fetch(`/api/reports/${reportId}/generation-sessions/${activeSessionId}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '加载会话失败')
        if (!cancelled) setDetail(data)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : '加载会话失败')
      }
    }
    void fetchDetail()
    return () => { cancelled = true }
  }, [activeSessionId, reportId])

  useLayoutEffect(() => {
    const transcript = transcriptRef.current
    if (!transcript || !detail) return

    if (initiallyScrolledSessionRef.current !== detail.id) {
      const target = Math.max(0, transcript.scrollHeight - transcript.clientHeight)
      autoScrollTopRef.current = target
      transcript.scrollTop = target
      shouldFollowTranscriptRef.current = true
      initiallyScrolledSessionRef.current = detail.id
      return
    }

    scheduleTranscriptFollow()
  }, [detail, liveReasoning, liveText, liveToolState, liveUser, scheduleTranscriptFollow, streaming])

  useEffect(() => () => {
    cancelTextReveal()
    if (reasoningFlushTimerRef.current !== null) clearTimeout(reasoningFlushTimerRef.current)
    const resolve = textQueueDrainedRef.current
    textQueueDrainedRef.current = null
    resolve?.()
    cancelTranscriptFollow()
  }, [cancelTextReveal, cancelTranscriptFollow])

  async function streamTurn(sessionId: number, message: string) {
    setStreaming(true)
    setLiveTurnId(null)
    setLiveUser(message)
    resetLiveOutput()
    setLiveProposal(null)
    try {
      const response = await fetch(`/api/reports/${reportId}/generation-sessions/${sessionId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '启动 AI 生成失败')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      const handle = (event: StreamEvent) => {
        if (event.type === 'start') setLiveTurnId(event.turnId)
        else if (event.type === 'reasoning-delta') queueLiveReasoning(event.text)
        else if (event.type === 'text-delta') queueLiveText(event.text)
        else if (event.type === 'tool-input-delta') setLiveToolState('正在整理候选终版...')
        else if (event.type === 'tool-call') setLiveToolState('正在调用 propose_final_report...')
        else if (event.type === 'tool-result') setLiveToolState('候选终版已提交，等待确认。')
        else if (event.type === 'proposal') setLiveProposal(event.proposal)
        else if (event.type === 'error') throw new Error(event.message)
      }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })
        const lines = pending.split('\n')
        pending = lines.pop() ?? ''
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as StreamEvent)
      }
      if (pending.trim()) handle(JSON.parse(pending) as StreamEvent)
      flushLiveReasoning()
      await waitForTextQueue()
      setLiveText((current) => finalizeStreamingMarkdown(current))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await Promise.all([loadDetail(sessionId, true), loadSessions(sessionId)])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 生成失败')
      flushLiveReasoning()
      await waitForTextQueue()
      setLiveText((current) => finalizeStreamingMarkdown(current))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await loadDetail(sessionId, true).catch(() => undefined)
    } finally {
      setStreaming(false)
      setLiveTurnId(null)
      setLiveUser('')
      resetLiveOutput()
    }
  }

  async function createSession() {
    if (!templateId || !composer.trim()) return
    setCreating(true)
    try {
      const response = await fetch(`/api/reports/${reportId}/generation-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant, templateId, styleOverride: styleOverride || undefined }),
      })
      const session = await response.json()
      if (!response.ok) throw new Error(session.error || '创建生成会话失败')
      setActiveSessionId(session.id)
      await loadSessions(session.id)
      await loadDetail(session.id)
      const initialMessage = composer.trim()
      setComposer('')
      await streamTurn(session.id, initialMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建生成会话失败')
    } finally {
      setCreating(false)
    }
  }

  async function sendMessage(message = composer) {
    if (!activeSessionId || !message.trim() || streaming) return
    setComposer('')
    await streamTurn(activeSessionId, message.trim())
  }

  async function stopTurn() {
    const turnId = liveTurnId ?? detail?.activeTurn?.id
    if (!activeSessionId || !turnId) return
    const response = await fetch(`/api/reports/${reportId}/generation-sessions/${activeSessionId}/turns/${turnId}/stop`, { method: 'POST' })
    if (!response.ok) toast.error('停止生成失败')
  }

  async function acceptProposal(proposal: Proposal) {
    if (!activeSessionId) return
    if (reportVariant.finalContent && !confirm('确认后会替换当前终版，是否继续？')) return
    setAccepting(true)
    try {
      const response = await fetch(`/api/reports/${reportId}/generation-sessions/${activeSessionId}/proposals/${proposal.id}/accept`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存候选终版失败')
      onAccepted(data.variant)
      await Promise.all([loadDetail(activeSessionId), loadSessions(activeSessionId)])
      toast.success('终版已保存，评分将在后台进行')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存候选终版失败')
    } finally {
      setAccepting(false)
    }
  }

  async function archiveSession() {
    if (!activeSessionId || !confirm('归档后仍可查看记录，但不能继续对话。确定归档吗？')) return
    const response = await fetch(`/api/reports/${reportId}/generation-sessions/${activeSessionId}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error || '归档失败')
    await loadSessions(activeSessionId)
    await loadDetail(activeSessionId)
  }

  async function renameSession() {
    if (!activeSessionId || !detail) return
    const title = prompt('会话标题', detail.title)
    if (!title || title.trim() === detail.title) return
    const response = await fetch(`/api/reports/${reportId}/generation-sessions/${activeSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error || '重命名失败')
    await Promise.all([loadDetail(activeSessionId), loadSessions(activeSessionId)])
  }

  const proposal = liveProposal ?? detail?.proposals.at(-1) ?? null
  const previousProposal = detail?.proposals.filter((item) => item.id !== proposal?.id).at(-1) ?? null
  const baseline = reportVariant.finalContent ?? previousProposal?.content ?? null
  const lastTurn = detail?.turns.at(-1)
  const lastUserMessage = lastTurn ? detail?.messages.find((part) => part.turnId === lastTurn.id && part.role === 'user' && part.partType === 'text')?.content : null
  const noProposalAfterLastTurn = Boolean(lastTurn?.status === 'completed' && !detail?.proposals.some((item) => item.turnId === lastTurn.id))
  const canChat = editable && detail?.status === 'active' && detail.sourceIsCurrent

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">加载生成会话...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <select className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={activeSessionId ?? ''} onChange={(event) => { const value = event.target.value; setActiveSessionId(value ? Number(value) : null); if (!value) setDetail(null) }}>
            <option value="">新建生成会话</option>
            {sessions.map((session) => <option key={session.id} value={session.id}>{session.status === 'archived' ? '[已归档] ' : ''}{session.title}</option>)}
          </select>
        </div>
        {editable && <Button variant="outline" size="sm" onClick={() => { setActiveSessionId(null); setDetail(null); setComposer(DEFAULT_GENERATION_INSTRUCTION) }}><Plus className="mr-1.5 h-4 w-4" />新会话</Button>}
      </div>

      {!activeSessionId ? (
        editable ? (
          <div className="mx-auto max-w-3xl space-y-5 rounded-xl border border-border p-5">
            <div><h2 className="font-semibold">创建 AI 生成会话</h2><p className="mt-1 text-sm text-muted-foreground">创建时会锁定当前原稿版本、模板、风格和系统提示词，然后直接发送下面这条初始指令。</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="generation-template">模板</Label><select id="generation-template" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={templateId} onChange={(event) => { setTemplateId(event.target.value); const selected = templates.find((item) => item.id === event.target.value); setStyleOverride(selected?.aiStyle ?? '') }}><option value="">请选择模板</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="generation-style">AI 风格</Label><select id="generation-style" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={styleOverride} onChange={(event) => setStyleOverride(event.target.value)}><option value="">使用模板默认风格</option>{styles.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="initial-generation-message">初始生成指令（可编辑）</Label><Textarea id="initial-generation-message" className="min-h-28" value={composer} onChange={(event) => setComposer(event.target.value)} /></div>
            <Button className="w-full" onClick={() => void createSession()} disabled={creating || !templateId || !composer.trim()}>{creating ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}创建会话并发送</Button>
          </div>
        ) : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">该版本还没有 AI 生成会话。</div>
      ) : !detail ? (
        <div className="py-12 text-center text-sm text-muted-foreground">加载对话...</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,44%)]">
          <section className="min-w-0 rounded-xl border border-border bg-muted/5">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate font-semibold">{detail.title}</h2>{detail.status === 'archived' && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">已归档</span>}</div><p className="mt-0.5 text-xs text-muted-foreground">{detail.templateName} · {detail.aiStyleLabel} · 原稿 r{detail.sourceRevision}{detail.turns.at(-1) ? ` · ${detail.turns.at(-1)?.protocol}/${detail.turns.at(-1)?.model}` : ''}</p></div>
              {editable && <div className="flex gap-1"><Button variant="ghost" size="icon-sm" title="重命名" onClick={() => void renameSession()}><Pencil /></Button>{detail.status === 'active' && <Button variant="ghost" size="icon-sm" title="归档" onClick={() => void archiveSession()} disabled={streaming}><Archive /></Button>}</div>}
            </div>
            {!detail.sourceIsCurrent && <div className="border-b border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-500">原稿已经更新。此会话保留用于审计，请从最新原稿创建新会话。</div>}
            <div ref={transcriptRef} onScroll={handleTranscriptScroll} className="generation-transcript max-h-[calc(100vh-15rem)] min-h-[520px] space-y-4 overflow-y-auto p-4">
              <SystemContextCard detail={detail} />
              {detail.messages.map((part) => <TranscriptPart key={part.id} part={part} />)}
              {liveUser && <TranscriptPart part={{ id: -1, turnId: liveTurnId, sequence: Number.MAX_SAFE_INTEGER, role: 'user', partType: 'text', content: liveUser, data: null }} />}
              <LiveAssistant reasoning={liveReasoning} text={liveText} toolState={liveToolState} working={streaming || Boolean(detail.activeTurn && !liveTurnId)} />
              {noProposalAfterLastTurn && !streaming && canChat && <div className="ml-11 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">本轮没有提交候选终版。<Button variant="link" className="h-auto px-1" onClick={() => void sendMessage('请把当前讨论形成一份完整候选终版，并调用 propose_final_report 提交。')}>提交当前版本</Button></div>}
              {lastTurn?.status === 'failed' && !streaming && canChat && lastUserMessage && <div className="ml-11 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">本轮生成失败。<Button variant="link" className="h-auto px-1 text-destructive" onClick={() => void sendMessage(lastUserMessage)}>重试本轮</Button></div>}
            </div>
            {canChat && (
              <div className="border-t border-border p-3">
                <Textarea value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="继续要求 AI 修改、追问，或让它提交当前版本..." disabled={streaming} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} />
                <div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Enter 发送，Shift+Enter 换行</p>{streaming ? <Button variant="outline" size="sm" onClick={() => void stopTurn()}><Square className="mr-1.5 h-3.5 w-3.5" />停止</Button> : <Button size="sm" onClick={() => void sendMessage()} disabled={!composer.trim()}><Send className="mr-1.5 h-3.5 w-3.5" />发送</Button>}</div>
              </div>
            )}
          </section>
          <ProposalReview proposal={proposal} baseline={baseline} editable={editable && detail.sourceIsCurrent} accepting={accepting} onAccept={() => proposal && void acceptProposal(proposal)} />
        </div>
      )}
    </div>
  )
}
