import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findVariant: vi.fn(),
  findReport: vi.fn(),
  findProposal: vi.fn(),
  findSession: vi.fn(),
  returning: vi.fn(),
  triggerScoring: vi.fn(),
  triggerLegacyScoring: vi.fn(),
  set: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    query: {
      reportVariants: { findFirst: mocks.findVariant },
      reports: { findFirst: mocks.findReport },
      generationProposals: { findFirst: mocks.findProposal },
      generationSessions: { findFirst: mocks.findSession },
    },
    update: () => ({
      set: (values: unknown) => {
        mocks.set(values)
        return {
        where: () => ({ returning: mocks.returning }),
        }
      },
    }),
    insert: () => ({ values: mocks.insert }),
    select: mocks.select,
  }),
}))

vi.mock('@/lib/scoring', () => ({
  triggerAsyncVariantScoring: mocks.triggerScoring,
  triggerAsyncScoring: mocks.triggerLegacyScoring,
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
  structureCompletenessRule: { version: 'next-week-plan-structure/v1', nextWeekPlan: 'required' },
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
    mocks.triggerLegacyScoring.mockResolvedValue({ success: true })
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

  it('retains the adopted contract when a direct edit submits different template text', async () => {
    mocks.returning.mockResolvedValue([{ ...existingVariant, finalContent: '新终版', scoreStatus: 'pending' }])
    const response = await PUT(new Request('http://localhost/api/reports/3/final', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variant: 'leadership', content: '新终版', sourceRevision: 2,
        templateContent: '明确禁止下周计划章节。',
      }),
    }), { params: Promise.resolve({ id: '3' }) })

    expect(response.status).toBe(200)
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({
      structureCompletenessRule: { version: 'next-week-plan-structure/v1', nextWeekPlan: 'required' },
    }))
  })

  it('saves a legacy personal final without creating a variant or generation record', async () => {
    mocks.findVariant.mockResolvedValue(undefined)
    mocks.findReport.mockResolvedValue({ id: 3, content: '旧版终稿' })
    mocks.returning.mockResolvedValue([{ id: 3, content: '已编辑旧版终稿', scoreStatus: 'pending' }])

    const response = await PUT(new Request('http://localhost/api/reports/3/final', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: 'personal', content: '已编辑旧版终稿' }),
    }), { params: Promise.resolve({ id: '3' }) })

    expect(response.status).toBe(200)
    expect(mocks.triggerLegacyScoring).toHaveBeenCalledWith(3)
    expect(mocks.findProposal).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('records a direct edit after an accepted session without changing its plan records', async () => {
    const sessionVariant = { ...existingVariant, acceptedProposalId: 44 }
    mocks.findVariant.mockResolvedValue(sessionVariant)
    mocks.returning.mockResolvedValue([{ ...sessionVariant, finalContent: '会话后编辑', scoreStatus: 'pending' }])
    mocks.findProposal.mockResolvedValue({ id: 44, sessionId: 9 })
    mocks.findSession.mockResolvedValue({ id: 9, reportId: 3 })
    mocks.select.mockReturnValue({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([{ sequence: 12 }]) }) }) }) })
    mocks.insert.mockResolvedValue(undefined)

    const response = await PUT(request(2), { params: Promise.resolve({ id: '3' }) })

    expect(response.status).toBe(200)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 9,
      sequence: 13,
      content: '会话基线后的用户编辑。',
    }))
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ baselineFinalContent: '会话后编辑' }))
  })
})
