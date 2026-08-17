import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
})
