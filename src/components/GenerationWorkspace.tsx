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
import { LEGACY_NO_SNAPSHOT, type CarryForwardSnapshot } from '@/lib/generation/carry-forward-snapshot'
import type { PlanState } from '@/lib/generation/plan'
import {
  publicPlanSourceLabel,
  type PublicGenerationSummary,
} from '@/lib/generation/public-summary'

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
  planState?: PlanState | null
  publicSummary?: PublicGenerationSummary | null
  baselineContent?: string | null
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
  planPolicy?: 'forbidden' | 'required' | null
  baselineFinalContent: string | null
  carryForwardSnapshot: CarryForwardSnapshot
  messages: MessagePart[]
  turns: Turn[]
  proposals: Proposal[]
  sourceIsCurrent: boolean
  activeTurn: Turn | null
  planJudgments?: Array<{ candidateId: string; judgment: string; reason: string; remainingAction: string | null }>
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
    ['Final report system prompt', detail.systemPrompt],
    [`AI style prompt · ${detail.aiStyleLabel}`, detail.aiStylePrompt],
    ['Tool rules', detail.toolRules],
  ] as const
  async function copy(value: string) {
    await navigator.clipboard.writeText(value)
    toast.success('Copied')
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/15 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bot className="h-4 w-4" />System message</div>
      <div className="space-y-2">
        {blocks.map(([label, content]) => (
          <details key={label} className="rounded-lg border border-border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">{label}</summary>
            <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={() => void copy(content)}><Clipboard className="mr-1.5 h-3.5 w-3.5" />Copy</Button></div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{content}</pre>
          </details>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Source draft overview</p>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" size="sm" />}><FileText className="mr-1.5 h-3.5 w-3.5" />View full source draft</DialogTrigger>
            <DialogContent className="max-h-[88vh] sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Full source draft used by this session</DialogTitle>
                <DialogDescription>This immutable snapshot is sent to AI and is the session’s only source of truth.</DialogDescription>
              </DialogHeader>
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-4 text-sm leading-6">{detail.sourceDraftSnapshot}</pre>
            </DialogContent>
          </Dialog>
        </div>
        <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{detail.sourceOverview}</pre>
      </div>
      <details className="mt-2 rounded-lg border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">Template snapshot · {detail.templateName}</summary>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{detail.templateContent}</pre>
      </details>
      <CarryForwardSnapshotCard snapshot={detail.carryForwardSnapshot} />
      <div className="mt-2 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        Template plan contract: {detail.planPolicy === 'forbidden' ? '章节禁止' : '允许/需要下周计划（缺少时追加）'}
      </div>
    </div>
  )
}

function CarryForwardSnapshotCard({ snapshot }: { snapshot?: CarryForwardSnapshot }) {
  const normalized = snapshot ?? LEGACY_NO_SNAPSHOT
  const source = normalized.source
  return (
    <details className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3" open>
      <summary className="cursor-pointer text-sm font-medium">Plan carry-forward snapshot · 历史参考·不可信</summary>
      <div className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
        <p>This immutable historical reference is not a fact of the current report.</p>
        <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
          <dt>Snapshot status</dt><dd className="font-medium text-foreground">{normalized.status}</dd>
          <dt>Parse status</dt><dd>{normalized.parseStatus}{normalized.parseReason ? ` · ${normalized.parseReason}` : ''}</dd>
          <dt>Snapshot captured</dt><dd>{normalized.capturedAt ?? 'not captured'}</dd>
          <dt>Source</dt><dd>{source ? `${source.title} · ${source.weekStart} – ${source.weekEnd} · ${source.audience} · ${source.finalStatus}` : 'No exact previous-cycle source'}</dd>
          <dt>Proposal reference</dt><dd>{source?.acceptedProposalId ?? 'none'}</dd>
        </dl>
        {normalized.parseWarning && <p className="text-amber-500">{normalized.parseWarning}</p>}
        <div>
          <p className="mb-1 font-medium text-foreground">Plan source copy</p>
          <pre className="whitespace-pre-wrap break-words rounded border border-border bg-background p-2">{normalized.planText ?? '(none)'}</pre>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Candidates ({normalized.candidates.length})</p>
          {normalized.candidates.length > 0 ? (
            <ul className="space-y-1">
              {normalized.candidates.map((candidate) => <li key={candidate.candidateId}>[{candidate.candidateId}] {candidate.text} · {candidate.judgment ?? 'pending judgment'}</li>)}
            </ul>
          ) : <p>(none)</p>}
        </div>
        {normalized.reason && <p>Reason: {normalized.reason}</p>}
      </div>
    </details>
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
        <p className="mb-2 text-xs font-medium text-violet-400">Provider reasoning / thinking</p>
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
      <p className="mb-2 text-xs font-medium text-violet-400">Provider reasoning / thinking</p>
          <div className="live-reasoning-line text-sm leading-6 text-muted-foreground">
            <span className="live-reasoning-content">{reasoning}</span>
          </div>
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
  editable,
  accepting,
  onAccept,
}: {
  proposal: Proposal | null
  editable: boolean
  accepting: boolean
  onAccept: () => void
}) {
  const [tab, setTab] = useState<ReviewTab>('preview')
  const diff = useMemo(() => proposal && proposal.baselineContent != null ? lineDiff(proposal.baselineContent, proposal.content) : [], [proposal])
  if (!proposal) {
    return (
      <aside className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        The proposed final version appears here after AI calls <code>propose_final_report</code>. Regular chat messages do not write directly to the report.
      </aside>
    )
  }

  return (
    <aside aria-label="Read-only proposal review" className="space-y-4 rounded-xl border border-border bg-background p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="font-semibold">Proposed final version</h3><p className="mt-0.5 text-xs text-muted-foreground">Read-only proposal review</p></div>
          <span className={`rounded-full px-2 py-1 text-xs ${proposal.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' : proposal.status === 'superseded' ? 'bg-muted text-muted-foreground' : 'bg-amber-500/10 text-amber-500'}`}>{proposal.status === 'accepted' ? 'Accepted' : proposal.status === 'superseded' ? 'Superseded' : 'Pending review'}</span>
        </div>
        {!proposal.publicSummary && proposal.summary.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{proposal.summary.map((item, index) => <li key={`${index}-${item}`}>• {item}</li>)}</ul>}
        {proposal.planState && <PlanStateSummary state={proposal.planState} />}
        {proposal.publicSummary && <PublicGenerationSummaryCard summary={proposal.publicSummary} />}
      </div>
      <div role="tablist" aria-label="Proposal views" className="flex rounded-lg bg-muted p-1">
        {([
          ['preview', Eye, 'Rendered preview'],
          ['source', Code2, 'Markdown source'],
          ['diff', FileDiff, 'Difference'],
        ] as const).map(([value, Icon, label]) => (
          <button key={value} role="tab" aria-selected={tab === value} type="button" onClick={() => setTab(value)} disabled={value === 'diff' && proposal.baselineContent == null} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${tab === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'} disabled:opacity-40`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>
      {tab === 'preview' && <div role="tabpanel" className="rounded-lg border border-border bg-[#141414] p-4 prose prose-sm prose-invert prose-report max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{proposal.content}</ReactMarkdown></div>}
      {tab === 'source' && <pre role="tabpanel" data-testid="proposal-markdown-source" className="max-h-[62vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-3 text-xs leading-5">{proposal.content}</pre>}
      {tab === 'diff' && proposal.baselineContent != null && (
        <div role="tabpanel" className="max-h-[62vh] overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs leading-5">
          {diff.map((line, index) => <div key={index} data-diff-type={line.type} className={line.type === 'add' ? 'bg-emerald-500/10 text-emerald-500' : line.type === 'remove' ? 'bg-red-500/10 text-red-400' : 'text-muted-foreground'}>{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '} {line.value || ' '}</div>)}
        </div>
      )}
      {editable && proposal.status === 'pending' && <Button className="w-full" onClick={onAccept} disabled={accepting}>{accepting ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}Accept and save final version</Button>}
      <p className="text-xs text-muted-foreground">The current final version is unchanged until you accept. You can continue improving it in this session after saving.</p>
    </aside>
  )
}

function SummarySection({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-foreground">{title}</p>
      {children ?? <p>none</p>}
    </div>
  )
}

function PublicGenerationSummaryCard({ summary }: { summary: PublicGenerationSummary }) {
  return (
    <section className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-muted-foreground">
      <h4 className="font-semibold text-foreground">Public generation summary</h4>
      <p className="mt-2 leading-5">{summary.factBoundary.statement}</p>
      <p className="mt-1">This records model-explicit handling only; hidden reasoning: {summary.factBoundary.hiddenReasoning}.</p>
      <dl className="mt-3 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt>Template section status</dt><dd>{summary.templateSection.policy} · {summary.templateSection.status}</dd>
        <dt>Structure completeness rules</dt><dd>{summary.structureCompleteness.ruleVersion} · {summary.structureCompleteness.status}</dd>
      </dl>
      <div className="mt-3 grid gap-3">
        <SummarySection title="Model-explicit handling">{summary.modelHandling.length > 0 ? <ul className="list-disc space-y-1 pl-4">{summary.modelHandling.map((item) => <li key={item}>{item}</li>)}</ul> : undefined}</SummarySection>
        <SummarySection title="Plan judgments">{summary.planJudgments.length > 0 ? <ul className="space-y-1">{summary.planJudgments.map((item) => <li key={item.candidateId}>[{item.candidateId}] {item.judgment} · {item.reason}{item.remainingAction !== 'none' ? ` · ${item.remainingAction}` : ''}</li>)}</ul> : undefined}</SummarySection>
        <SummarySection title="Plan override conclusions">{summary.planOverrideConclusions.length > 0 ? <ul className="space-y-1">{summary.planOverrideConclusions.map((item) => <li key={`${item.itemId}-${item.action}`}>{item.action} · {item.result}</li>)}</ul> : undefined}</SummarySection>
        <SummarySection title="Item sources">{summary.planItems.length > 0 ? <ul className="space-y-1">{summary.planItems.map((item, index) => <li key={`${item.candidateId}-${index}`}><span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{publicPlanSourceLabel(item.source)}</span>{item.text}</li>)}</ul> : undefined}</SummarySection>
        <SummarySection title="Historical references">{summary.historicalReferences.length > 0 ? <ul className="space-y-1">{summary.historicalReferences.map((item) => <li key={`${item.kind}-${item.reportId}`}>{item.title} · {item.weekStart} – {item.weekEnd} · {item.audience} · {item.finalStatus} · 历史参考·不可信</li>)}</ul> : undefined}</SummarySection>
        <SummarySection title="Tool status">{summary.toolStatuses.length > 0 ? <ul className="space-y-1">{summary.toolStatuses.map((item) => <li key={`${item.toolName}-${item.status}`}>{item.toolName} · {item.status}{item.detail !== 'none' ? ` · ${item.detail}` : ''}</li>)}</ul> : undefined}</SummarySection>
        <SummarySection title="Failure states">{summary.failureStates.length > 0 ? <ul className="space-y-1">{summary.failureStates.map((item) => <li key={`${item.scope}-${item.code}`}>{item.code} · {item.message}</li>)}</ul> : undefined}</SummarySection>
        <SummarySection title="Truncation states">{summary.truncationStates.length > 0 ? <ul className="space-y-1">{summary.truncationStates.map((item) => <li key={`${item.scope}-${item.omittedCount}`}>{item.message}</li>)}</ul> : undefined}</SummarySection>
        <SummarySection title="Change summary">{summary.changeSummary.length > 0 ? <ul className="list-disc space-y-1 pl-4">{summary.changeSummary.map((item) => <li key={item}>{item}</li>)}</ul> : undefined}</SummarySection>
      </div>
    </section>
  )
}

function PlanStateSummary({ state }: { state: PlanState }) {
  return (
    <details className="mt-3 rounded-lg border border-border bg-muted/20 p-3" open>
      <summary className="cursor-pointer text-xs font-medium">Next-week plan · {state.status === 'forbidden' ? '章节禁止' : state.status === 'empty' ? '空计划' : `${state.items.length} 项`}</summary>
      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
        <p>Section: {state.section}{state.truncatedCount > 0 ? ` · truncated ${state.truncatedCount}` : ''}</p>
        {state.items.length > 0 && <ul className="list-disc space-y-1 pl-4">{state.items.map((item) => <li key={`${item.source}-${item.candidateId ?? item.text}`}>{item.text} · {item.source === 'carry-forward' ? 'carry-forward' : item.source === 'baseline' ? '编辑基线' : '本周新增'}</li>)}</ul>}
        {state.judgments.length > 0 && <ul className="space-y-1">{state.judgments.map((judgment) => <li key={judgment.candidateId}>[{judgment.candidateId}] {judgment.judgment} · {judgment.reason}</li>)}</ul>}
        {state.warnings.map((warning) => <p key={warning} role="alert" className="text-amber-600 dark:text-amber-400">{warning}</p>)}
      </div>
    </details>
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
    if (!response.ok) throw new Error(data.error || 'Failed to load generation sessions')
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
    if (!response.ok) throw new Error(data.error || 'Failed to load session')
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
        if (!response.ok) throw new Error(data.error || 'Failed to load generation sessions')
        if (cancelled) return
        const rows = (data.sessions ?? []) as SessionSummary[]
        setSessions(rows)
        setActiveSessionId(rows[0]?.id ?? null)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Failed to load generation sessions')
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
        if (!response.ok) throw new Error(data.error || 'Failed to load session')
        if (!cancelled) setDetail(data)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Failed to load session')
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
        throw new Error(data.error || 'Failed to start AI generation')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      const handle = (event: StreamEvent) => {
        if (event.type === 'start') setLiveTurnId(event.turnId)
        else if (event.type === 'reasoning-delta') queueLiveReasoning(event.text)
        else if (event.type === 'text-delta') queueLiveText(event.text)
        else if (event.type === 'tool-input-delta') setLiveToolState('Preparing proposed final version...')
        else if (event.type === 'tool-call') setLiveToolState('Calling propose_final_report...')
        else if (event.type === 'tool-result') setLiveToolState('Proposed final version submitted; awaiting review.')
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
      toast.error(error instanceof Error ? error.message : 'AI generation failed')
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
      if (!response.ok) throw new Error(session.error || 'Failed to create generation session')
      setActiveSessionId(session.id)
      await loadSessions(session.id)
      await loadDetail(session.id)
      const initialMessage = composer.trim()
      setComposer('')
      await streamTurn(session.id, initialMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create generation session')
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
    if (!response.ok) toast.error('Failed to stop generation')
  }

  async function acceptProposal(proposal: Proposal) {
    if (!activeSessionId) return
    if (reportVariant.finalContent && !confirm('Accepting will replace the current final version. Continue?')) return
    setAccepting(true)
    try {
      const response = await fetch(`/api/reports/${reportId}/generation-sessions/${activeSessionId}/proposals/${proposal.id}/accept`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save proposed final version')
      onAccepted(data.variant)
      await Promise.all([loadDetail(activeSessionId), loadSessions(activeSessionId)])
      toast.success('Final version saved; scoring will run in the background')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save proposed final version')
    } finally {
      setAccepting(false)
    }
  }

  async function archiveSession() {
    if (!activeSessionId || !confirm('After archiving, the record remains viewable but cannot continue chatting. Archive this session?')) return
    const response = await fetch(`/api/reports/${reportId}/generation-sessions/${activeSessionId}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error || 'Archive failed')
    await loadSessions(activeSessionId)
    await loadDetail(activeSessionId)
  }

  async function renameSession() {
    if (!activeSessionId || !detail) return
    const title = prompt('Session title', detail.title)
    if (!title || title.trim() === detail.title) return
    const response = await fetch(`/api/reports/${reportId}/generation-sessions/${activeSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error || 'Rename failed')
    await Promise.all([loadDetail(activeSessionId), loadSessions(activeSessionId)])
  }

  const proposal = liveProposal ?? detail?.proposals.at(-1) ?? null
  const lastTurn = detail?.turns.at(-1)
  const lastUserMessage = lastTurn ? detail?.messages.find((part) => part.turnId === lastTurn.id && part.role === 'user' && part.partType === 'text')?.content : null
  const noProposalAfterLastTurn = Boolean(lastTurn?.status === 'completed' && !detail?.proposals.some((item) => item.turnId === lastTurn.id))
  const canChat = editable && detail?.status === 'active' && detail.sourceIsCurrent

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading generation sessions...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <select className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={activeSessionId ?? ''} onChange={(event) => { const value = event.target.value; setActiveSessionId(value ? Number(value) : null); if (!value) setDetail(null) }}>
            <option value="">New generation session</option>
            {sessions.map((session) => <option key={session.id} value={session.id}>{session.status === 'archived' ? '[Archived] ' : ''}{session.title}</option>)}
          </select>
        </div>
        {editable && <Button variant="outline" size="sm" onClick={() => { setActiveSessionId(null); setDetail(null); setComposer(DEFAULT_GENERATION_INSTRUCTION) }}><Plus className="mr-1.5 h-4 w-4" />New session</Button>}
      </div>

      {!activeSessionId ? (
        editable ? (
          <div className="mx-auto max-w-3xl space-y-5 rounded-xl border border-border p-5">
            <div><h2 className="font-semibold">Create AI generation session</h2><p className="mt-1 text-sm text-muted-foreground">The current source draft, template, style, and system prompts are locked when you create the session, then the initial instruction below is sent.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="generation-template">Template</Label><select id="generation-template" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={templateId} onChange={(event) => { setTemplateId(event.target.value); const selected = templates.find((item) => item.id === event.target.value); setStyleOverride(selected?.aiStyle ?? '') }}><option value="">Select a template</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="generation-style">AI style</Label><select id="generation-style" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={styleOverride} onChange={(event) => setStyleOverride(event.target.value)}><option value="">Use template default style</option>{styles.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="initial-generation-message">Initial instruction (editable)</Label><Textarea id="initial-generation-message" className="min-h-28" value={composer} onChange={(event) => setComposer(event.target.value)} /></div>
            <Button className="w-full" onClick={() => void createSession()} disabled={creating || !templateId || !composer.trim()}>{creating ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}Create session and send</Button>
          </div>
        ) : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">This version has no AI generation sessions.</div>
      ) : !detail ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading chat...</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,44%)]">
          <section className="min-w-0 rounded-xl border border-border bg-muted/5">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate font-semibold">{detail.title}</h2>{detail.status === 'archived' && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Archived</span>}</div><p className="mt-0.5 text-xs text-muted-foreground">{detail.templateName} · {detail.aiStyleLabel} · Source r{detail.sourceRevision}{detail.turns.at(-1) ? ` · ${detail.turns.at(-1)?.protocol}/${detail.turns.at(-1)?.model}` : ''}</p></div>
              {editable && <div className="flex gap-1"><Button variant="ghost" size="icon-sm" title="Rename" onClick={() => void renameSession()}><Pencil /></Button>{detail.status === 'active' && <Button variant="ghost" size="icon-sm" title="Archive" onClick={() => void archiveSession()} disabled={streaming}><Archive /></Button>}</div>}
            </div>
              {!detail.sourceIsCurrent && <div className="border-b border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-500">The source draft has changed. This session is retained for audit; create a new session from the latest draft.</div>}
            <div ref={transcriptRef} onScroll={handleTranscriptScroll} className="generation-transcript max-h-[calc(100vh-15rem)] min-h-[520px] space-y-4 overflow-y-auto p-4">
              <SystemContextCard detail={detail} />
              {detail.messages.map((part) => <TranscriptPart key={part.id} part={part} />)}
              {liveUser && <TranscriptPart part={{ id: -1, turnId: liveTurnId, sequence: Number.MAX_SAFE_INTEGER, role: 'user', partType: 'text', content: liveUser, data: null }} />}
              <LiveAssistant reasoning={liveReasoning} text={liveText} toolState={liveToolState} working={streaming || Boolean(detail.activeTurn && !liveTurnId)} />
              {noProposalAfterLastTurn && !streaming && canChat && <div className="ml-11 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">No proposed final version was submitted this turn. <Button variant="link" className="h-auto px-1" onClick={() => void sendMessage('Turn the current discussion into a complete proposed final version and submit it with propose_final_report.')}>Submit current version</Button></div>}
              {lastTurn?.status === 'failed' && !streaming && canChat && lastUserMessage && <div className="ml-11 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">Generation failed this turn. <Button variant="link" className="h-auto px-1 text-destructive" onClick={() => void sendMessage(lastUserMessage)}>Retry turn</Button></div>}
            </div>
            {canChat && (
              <div className="border-t border-border p-3">
                <Textarea value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="Ask AI to revise, answer a question, or submit the current version..." disabled={streaming} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} />
                <div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Enter to send, Shift+Enter for a new line</p>{streaming ? <Button variant="outline" size="sm" onClick={() => void stopTurn()}><Square className="mr-1.5 h-3.5 w-3.5" />Stop</Button> : <Button size="sm" onClick={() => void sendMessage()} disabled={!composer.trim()}><Send className="mr-1.5 h-3.5 w-3.5" />Send</Button>}</div>
              </div>
            )}
          </section>
          <ProposalReview proposal={proposal} editable={editable && detail.sourceIsCurrent} accepting={accepting} onAccept={() => proposal && void acceptProposal(proposal)} />
        </div>
      )}
    </div>
  )
}
