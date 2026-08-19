import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GenerationWorkspace } from './GenerationWorkspace'
import type { ReportVariant } from '@/lib/db/schema'

const mockFetch = vi.fn()
const detailLoaded = Promise.withResolvers<{ ok: boolean; json: () => Promise<unknown> }>()

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
global.fetch = mockFetch

const session = {
  id: 7,
  title: '本周终版',
  status: 'active' as const,
  variant: 'personal' as const,
  sourceRevision: 1,
  templateName: '标准模板',
  aiStyleLabel: '正式',
  updatedAt: '2026-08-19T00:00:00.000Z',
  latestTurn: null,
  latestProposal: null,
}

const detail = {
  ...session,
  sourceDraftSnapshot: '原稿',
  sourceOverview: '原稿概要',
  templateId: 'template-1',
  templateContent: '# 模板',
  aiStyleKey: 'formal',
  aiStylePrompt: '正式',
  systemPrompt: '系统提示词',
  toolRules: '工具规则',
  baselineFinalContent: null,
  messages: [],
  turns: [],
  proposals: [],
  sourceIsCurrent: true,
  activeTurn: null,
}

describe('GenerationWorkspace streaming output', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let frameTime = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => {
      frameTime += 50
      callback(frameTime)
    }, 0))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))

    let detailRequests = 0
    mockFetch.mockImplementation((url: string, options?: { method?: string }) => {
      if (url === '/api/reports/1/generation-sessions?variant=personal') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ sessions: [session] }) })
      }
      if (url === '/api/reports/1/generation-sessions/7') {
        detailRequests += 1
        if (detailRequests > 1) return detailLoaded.promise
        return Promise.resolve({ ok: true, json: () => Promise.resolve(detail) })
      }
      if (url === '/api/reports/1/generation-sessions/7/turns' && options?.method === 'POST') {
        const encoder = new TextEncoder()
        const events = [
          { type: 'start', turnId: 11, protocol: 'openai', model: 'test' },
          { type: 'text-delta', text: '已完成段落。\n\n末尾 **未完成' },
          { type: 'finish', status: 'completed' },
        ]
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(events.map((event) => JSON.stringify(event)).join('\n')))
            controller.close()
          },
        })
        return Promise.resolve(new Response(body))
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unknown' }) })
    })
  })

  it('keeps the unfinished block stable and does not restart smooth scrolling per stream chunk', async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    render(
      <GenerationWorkspace
        reportId={1}
        variant="personal"
        reportVariant={{ finalContent: null } as ReportVariant}
        templates={[]}
        styles={[]}
        editable
        onAccepted={vi.fn()}
      />,
    )

    await screen.findByRole('heading', { name: '本周终版' })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    const completedParagraph = await screen.findByText('已完成段落。')
    const pendingBlock = await screen.findByText('末尾 **未完成')
    expect(completedParagraph.closest('.streaming-markdown-pending')).toBeNull()
    expect(pendingBlock.parentElement).toHaveClass('streaming-markdown-pending')
    expect(pendingBlock.querySelector('strong')).toBeNull()
    expect(scrollIntoView).not.toHaveBeenCalled()

    detailLoaded.resolve({ ok: true, json: () => Promise.resolve(detail) })
    await waitFor(() => expect(screen.queryByText('末尾 **未完成')).not.toBeInTheDocument())
    scrollIntoView.mockRestore()
  })
})
