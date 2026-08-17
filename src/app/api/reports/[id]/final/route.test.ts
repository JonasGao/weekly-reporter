import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findVariant: vi.fn(),
  returning: vi.fn(),
  triggerScoring: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    query: { reportVariants: { findFirst: mocks.findVariant } },
    update: () => ({
      set: () => ({
        where: () => ({ returning: mocks.returning }),
      }),
    }),
  }),
}))

vi.mock('@/lib/scoring', () => ({
  triggerAsyncVariantScoring: mocks.triggerScoring,
}))

import { PUT } from './route'

const existingVariant = {
  id: 10,
  reportId: 3,
  variant: 'leadership',
  sourceDraft: '- 完成工作事项',
  finalContent: '旧终版',
  finalStatus: 'current',
  templateId: 'official-general',
  templateName: '通用模板',
  templateContent: '# 模板',
  aiStyle: 'formal',
  sourceRevision: 2,
}

function request(sourceRevision: number) {
  return new Request('http://localhost/api/reports/3/final', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      variant: 'leadership',
      content: '新终版',
      sourceRevision,
      templateId: 'official-general',
      templateName: '通用模板',
      templateContent: '# 模板',
      aiStyle: 'formal',
    }),
  })
}

describe('PUT /api/reports/[id]/final', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findVariant.mockResolvedValue(existingVariant)
    mocks.triggerScoring.mockResolvedValue({ success: true })
  })

  it('rejects a preview generated from an outdated source revision', async () => {
    const response = await PUT(request(1), { params: Promise.resolve({ id: '3' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('SOURCE_REVISION_CONFLICT')
    expect(mocks.returning).not.toHaveBeenCalled()
    expect(mocks.triggerScoring).not.toHaveBeenCalled()
  })

  it('saves and scores the selected audience variant when the revision matches', async () => {
    const updated = { ...existingVariant, finalContent: '新终版', scoreStatus: 'pending' }
    mocks.returning.mockResolvedValue([updated])

    const response = await PUT(request(2), { params: Promise.resolve({ id: '3' }) })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: 10, variant: 'leadership', finalContent: '新终版' })
    await vi.waitFor(() => expect(mocks.triggerScoring).toHaveBeenCalledWith(10))
  })
})
