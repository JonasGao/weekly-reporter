import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getReportBundle: vi.fn(),
  getTemplateSelection: vi.fn(),
  getAIStyle: vi.fn(),
  generateFinalReport: vi.fn(),
}))

vi.mock('@/lib/reports/service', () => ({
  getReportBundle: mocks.getReportBundle,
  getTemplateSelection: mocks.getTemplateSelection,
}))

vi.mock('@/lib/ai/styles', () => ({ getAIStyle: mocks.getAIStyle }))
vi.mock('@/lib/ai', () => ({ generateFinalReport: mocks.generateFinalReport }))

import { POST } from './route'

describe('POST /api/reports/[id]/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getReportBundle.mockResolvedValue({
      id: 3,
      weekStart: '2026-08-10',
      weekEnd: '2026-08-16',
      variants: [
        { variant: 'leadership', sourceDraft: '- 领导可见事项', sourceRevision: 4 },
        { variant: 'personal', sourceDraft: '- 私人项目事项', sourceRevision: 4 },
      ],
    })
    mocks.getTemplateSelection.mockResolvedValue({
      id: 'official-general',
      name: '通用模板',
      content: '# 本周工作',
      aiStyle: 'formal',
    })
    mocks.getAIStyle.mockResolvedValue({ systemPrompt: '正式风格', temperature: 0.3 })
    mocks.generateFinalReport.mockResolvedValue('# 终版')
  })

  it('sends only the selected leadership source draft to AI', async () => {
    const request = new Request('http://localhost/api/reports/3/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: 'leadership', templateId: 'official-general' }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: '3' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sourceRevision).toBe(4)
    expect(mocks.generateFinalReport).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDraft: '- 领导可见事项',
        variant: 'leadership',
        template: '# 本周工作',
      }),
      0.3,
    )
    expect(JSON.stringify(mocks.generateFinalReport.mock.calls)).not.toContain('私人项目事项')
  })
})
