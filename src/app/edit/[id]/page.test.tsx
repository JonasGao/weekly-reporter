import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import EditReportPage from './page'

const mockFetch = vi.fn()
vi.mock('next/navigation', () => ({ useParams: () => ({ id: '1' }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
global.fetch = mockFetch

describe('EditReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/reports/1') return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, title: 'Test Report', weekStart: '2026-08-17', weekEnd: '2026-08-23', variants: [{ id: 1, variant: 'personal', sourceDraft: '- 本周暂无事件', finalContent: null, finalStatus: 'none' }, { id: 2, variant: 'leadership', sourceDraft: '- 本周暂无事件', finalContent: null, finalStatus: 'none' }] }) })
      if (url === '/api/templates') return Promise.resolve({ ok: true, json: () => Promise.resolve({ official: [], user: [] }) })
      if (url === '/api/prompts/styles') return Promise.resolve({ ok: true, json: () => Promise.resolve({ styles: [] }) })
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unknown' }) })
    })
  })

  it('loads both persisted audience variants without the old variable toolbar', async () => {
    render(<EditReportPage />)
    await waitFor(() => expect(screen.getByText('个人版')).toBeInTheDocument())
    expect(screen.getByText('领导版')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /插入变量/i })).not.toBeInTheDocument()
  })

  it('shows generation as a conversation and keeps the source draft in a scroll area', async () => {
    const sourceDraft = Array.from({ length: 40 }, (_, index) => `- 原稿事项 ${index + 1}`).join('\n')
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/reports/1') return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          title: 'Test Report',
          weekStart: '2026-08-17',
          weekEnd: '2026-08-23',
          variants: [{ id: 1, variant: 'personal', sourceDraft, sourceRevision: 2, finalContent: null, finalStatus: 'none' }],
        }),
      })
      if (url === '/api/templates') return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          official: [{ id: 'official-general', name: '通用模板', content: '# 本周工作', aiStyle: 'formal' }],
          user: [],
        }),
      })
      if (url === '/api/prompts/styles') return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ styles: [{ key: 'formal', label: '正式风格' }] }),
      })
      if (url === '/api/reports/1/generate') return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          content: '# 终版内容',
          summary: ['采用本周工作章节', '合并同类原稿事项'],
          template: { id: 'official-general', name: '通用模板', content: '# 本周工作' },
          aiStyle: 'formal',
          sourceRevision: 2,
        }),
      })
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unknown' }) })
    })

    render(<EditReportPage />)

    const generateButton = await screen.findByRole('button', { name: '开始生成' })
    const sourceScroll = screen.getByTestId('source-draft-scroll')
    expect(sourceScroll).toHaveClass('overflow-y-auto')
    expect(sourceScroll.className).toContain('max-h-')

    fireEvent.click(generateButton)

    expect(await screen.findByText('AI 生成对话')).toBeInTheDocument()
    expect(screen.getByText('查看原稿')).toBeInTheDocument()
    expect(screen.getByText('查看模板')).toBeInTheDocument()
    expect(await screen.findByText('处理摘要')).toBeInTheDocument()
    expect(screen.getByText('采用本周工作章节')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '终版内容' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '采用此版本' })).toBeInTheDocument()
  })
})
