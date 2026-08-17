import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { previewReportSourceDrafts } from '@/lib/reports/service'

vi.mock('@/lib/reports/service', () => ({
  previewReportSourceDrafts: vi.fn(),
}))

describe('POST /api/reports/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns both source drafts without creating a report', async () => {
    vi.mocked(previewReportSourceDrafts).mockResolvedValue([
      { variant: 'leadership', sourceDraft: '- 工作事项' },
      { variant: 'personal', sourceDraft: '- 工作事项\n- 个人事项' },
    ])

    const response = await POST(new Request('http://localhost/api/reports/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart: '2026-08-10', weekEnd: '2026-08-16' }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      variants: [
        { variant: 'leadership', sourceDraft: '- 工作事项' },
        { variant: 'personal', sourceDraft: '- 工作事项\n- 个人事项' },
      ],
    })
    expect(previewReportSourceDrafts).toHaveBeenCalledWith({
      weekStart: '2026-08-10',
      weekEnd: '2026-08-16',
    })
  })

  it('rejects an invalid date range before querying drafts', async () => {
    const response = await POST(new Request('http://localhost/api/reports/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart: '2026-08-17', weekEnd: '2026-08-10' }),
    }))

    expect(response.status).toBe(400)
    expect(previewReportSourceDrafts).not.toHaveBeenCalled()
  })
})
