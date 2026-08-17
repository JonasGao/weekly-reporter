import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewReportPage from './page'

const mockPush = vi.fn()
const mockFetch = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, back: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/button', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/button')>('@/components/ui/button')
  return actual
})

global.fetch = mockFetch

describe('NewReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ report: { id: 7 }, variants: [] }),
    })
  })

  it('does not load templates or render events during initial creation', () => {
    render(<NewReportPage />)
    expect(screen.getByRole('heading', { name: '新建周报' })).toBeInTheDocument()
    expect(screen.getByText(/两份原稿/)).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('creates a report with title and week range only', async () => {
    render(<NewReportPage />)
    fireEvent.click(screen.getByRole('button', { name: '创建原稿' }))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toEqual(expect.objectContaining({ title: expect.any(String), weekStart: expect.any(String), weekEnd: expect.any(String) }))
    expect(body).not.toHaveProperty('templateId')
    expect(body).not.toHaveProperty('content')
  })
})
