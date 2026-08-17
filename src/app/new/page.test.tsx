import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import NewReportPage from './page'

const mockPush = vi.fn()
const mockFetch = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/button', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/button')>('@/components/ui/button')
  return actual
})

global.fetch = mockFetch

const previewResponse = {
  variants: [
    { variant: 'leadership', sourceDraft: '- 领导事项' },
    { variant: 'personal', sourceDraft: '- 个人事项' },
  ],
}

function response(data: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(data) }
}

describe('NewReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not fetch or persist anything on initial render', () => {
    render(<NewReportPage />)
    expect(screen.getByRole('heading', { name: '新建周报' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览原稿' })).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('loads a read-only preview for both audience variants without navigating', async () => {
    mockFetch.mockResolvedValueOnce(response(previewResponse))
    render(<NewReportPage />)

    fireEvent.click(screen.getByRole('button', { name: '预览原稿' }))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/reports/preview', expect.objectContaining({ method: 'POST' })))

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      weekStart: expect.any(String),
      weekEnd: expect.any(String),
    })
    expect(screen.getByText('原稿预览（只读）')).toBeInTheDocument()
    expect(screen.getByText('领导事项')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /个人版/ })).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: /个人版/ }))
    expect(await screen.findByText('个人事项')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('persists only after the preview is confirmed', async () => {
    mockFetch
      .mockResolvedValueOnce(response(previewResponse))
      .mockResolvedValueOnce(response({ report: { id: 7 } }))
    render(<NewReportPage />)

    fireEvent.click(screen.getByRole('button', { name: '预览原稿' }))
    await screen.findByText('原稿预览（只读）')
    fireEvent.click(screen.getByRole('button', { name: '确认创建' }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    expect(mockFetch.mock.calls[1][0]).toBe('/api/reports')
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual(expect.objectContaining({
      title: expect.any(String),
      weekStart: expect.any(String),
      weekEnd: expect.any(String),
    }))
    expect(mockPush).toHaveBeenCalledWith('/reports/7')
  })

  it('clears an existing preview when the week changes', async () => {
    mockFetch.mockResolvedValueOnce(response(previewResponse))
    render(<NewReportPage />)

    fireEvent.click(screen.getByRole('button', { name: '预览原稿' }))
    await screen.findByText('原稿预览（只读）')
    fireEvent.click(screen.getByRole('button', { name: '下一周' }))

    expect(screen.queryByText('原稿预览（只读）')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览原稿' })).toBeInTheDocument()
  })
})
