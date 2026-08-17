import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import EditReportPage from '../[id]/page'

const mockFetch = vi.fn()
vi.mock('next/navigation', () => ({ useParams: () => ({ id: '1' }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
global.fetch = mockFetch

describe('EditReportPage - legacy report compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/reports/1') return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, title: 'Legacy report', content: 'Legacy content', weekStart: '2026-08-17', weekEnd: '2026-08-23' }) })
      if (url === '/api/templates') return Promise.resolve({ ok: true, json: () => Promise.resolve({ official: [], user: [] }) })
      if (url === '/api/prompts/styles') return Promise.resolve({ ok: true, json: () => Promise.resolve({ styles: [] }) })
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unknown' }) })
    })
  })

  it('shows old single content as a legacy personal final', async () => {
    render(<EditReportPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Legacy report' })).toBeInTheDocument())
    expect(screen.getByText('个人版')).toBeInTheDocument()
    expect(screen.queryByText('插入变量')).not.toBeInTheDocument()
  })
})
