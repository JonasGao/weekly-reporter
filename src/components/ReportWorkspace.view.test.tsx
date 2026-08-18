import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReportWorkspace } from './ReportWorkspace'

const mockFetch = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
global.fetch = mockFetch

describe('ReportWorkspace read-only typography', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/reports/1') return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 1,
          title: 'Test Report',
          weekStart: '2026-08-17',
          weekEnd: '2026-08-23',
          variants: [{
            id: 1,
            reportId: 1,
            variant: 'personal',
            sourceDraft: '- 原稿事项',
            finalContent: '### 工作小结\n\n这是正文段落。',
            finalStatus: 'current',
            sourceRevision: 1,
            scoreStatus: 'completed',
          }],
        }),
      })
      if (url === '/api/templates') return Promise.resolve({ ok: true, json: () => Promise.resolve({ official: [], user: [] }) })
      if (url === '/api/prompts/styles') return Promise.resolve({ ok: true, json: () => Promise.resolve({ styles: [] }) })
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unknown' }) })
    })
  })

  it('scopes theme-aware reading styles to the rendered report body', async () => {
    render(<ReportWorkspace reportId={1} editable={false} />)

    const heading = await screen.findByRole('heading', { level: 3, name: '工作小结' })
    const reportBody = heading.closest('.report-view-content')
    expect(reportBody).toBeInTheDocument()
    expect(reportBody).toHaveClass('bg-card', 'text-card-foreground')
    expect(reportBody).not.toHaveClass('prose-invert')

    await waitFor(() => expect(screen.getByTestId('source-draft-scroll')).toBeInTheDocument())
    expect(screen.getByTestId('source-draft-scroll')).not.toHaveClass('report-view-content')
  })
})
