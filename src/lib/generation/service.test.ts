import { describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  generationMessageParts,
  generationPlanOverrides,
  generationProposals,
  generationSessions,
  generationTurns,
  reportVariants,
  reports,
} from '@/lib/db/schema'
import {
  acceptGenerationProposal,
  appendPlanOverride,
  createGenerationProposal,
  createGenerationSession,
  finishGenerationTurn,
  getGenerationSessionDetail,
  startGenerationTurn,
} from './service'

vi.mock('@/lib/scoring', () => ({
  triggerAsyncVariantScoring: vi.fn(() => Promise.resolve({ success: true })),
}))

describe('generation session lifecycle', () => {
  it('snapshots context and only writes the final when a proposal is accepted', async () => {
    const db = getDb()
    const now = new Date()
    const report = db.insert(reports).values({
      title: `generation-test-${Date.now()}`,
      content: '- 完成会话持久化',
      weekStart: '2026-08-10',
      weekEnd: '2026-08-16',
      scoreStatus: 'completed',
      createdAt: now,
      updatedAt: now,
    }).returning().get()
    const variant = db.insert(reportVariants).values({
      reportId: report.id,
      variant: 'personal',
      sourceDraft: '- **weekly-reporter**\n  - 完成会话持久化',
      sourceRevision: 3,
      finalStatus: 'none',
      scoreStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    }).returning().get()

    const session = await createGenerationSession({
      reportId: report.id,
      variant: 'personal',
      templateId: 'official-general',
    })
    const detail = await getGenerationSessionDetail(report.id, session.id)
    expect(detail?.messages.map((part) => part.partType)).toEqual([
      'system-prompt',
      'style-prompt',
      'tool-rules',
      'source-overview',
    ])
    expect(detail?.sourceDraftSnapshot).toContain('完成会话持久化')
    expect(detail?.carryForwardSnapshot).toMatchObject({
      status: 'no-source',
      source: null,
      candidates: [],
    })

    const turn = startGenerationTurn({
      session,
      config: {
        id: 1,
        protocol: 'openai-compatible',
        apiUrl: 'https://example.invalid',
        apiKey: 'test',
        model: 'test-model',
        modelListCache: null,
        modelListCachedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      userMessage: '请生成候选终版',
    })
    const proposal = await createGenerationProposal({
      session,
      turnId: turn.id,
      content: '# 本周完成\n\n- 完成会话持久化',
      summary: ['按模板归类原稿事实'],
      publicSummary: { modelHandling: ['仅依据个人版周报原稿整理本周事实。'] },
    })
    await finishGenerationTurn(turn.id, 'completed')

    const preAcceptanceOverride = await appendPlanOverride({
      reportId: report.id,
      sessionId: session.id,
      action: 'keep',
      text: '采用前新增事项',
    })
    expect(db.select().from(generationProposals).where(eq(generationProposals.id, proposal.id)).get()?.status).toBe('superseded')
    await expect(acceptGenerationProposal({
      reportId: report.id,
      sessionId: session.id,
      proposalId: proposal.id,
    })).rejects.toMatchObject({ code: 'PROPOSAL_SUPERSEDED' })

    db.delete(generationPlanOverrides).where(eq(generationPlanOverrides.id, preAcceptanceOverride.id)).run()
    db.update(generationProposals).set({ status: 'pending' }).where(eq(generationProposals.id, proposal.id)).run()

    expect(db.select().from(reportVariants).where(eq(reportVariants.id, variant.id)).get()?.finalContent).toBeNull()
    expect(proposal.baselineContent).toBe('')
    expect(proposal.publicSummary).toMatchObject({
      version: 1,
      modelHandling: ['仅依据个人版周报原稿整理本周事实。'],
      planJudgments: [],
      planOverrideConclusions: [],
      planItems: [],
      historicalReferences: [],
      toolStatuses: [{ toolName: 'propose_final_report', status: 'succeeded', detail: 'proposal-created' }],
      truncationStates: [],
      changeSummary: ['按模板归类原稿事实'],
      factBoundary: { currentWeekFacts: 'report-source-draft-only', scoringInput: 'none' },
      structureCompleteness: { ruleVersion: 'next-week-plan-structure/v1', status: 'satisfied' },
    })

    const accepted = await acceptGenerationProposal({
      reportId: report.id,
      sessionId: session.id,
      proposalId: proposal.id,
    })
    expect(accepted.variant.finalContent).toContain('完成会话持久化')
    expect(accepted.variant.acceptedProposalId).toBe(proposal.id)
    expect(db.select().from(reports).where(eq(reports.id, report.id)).get()?.content).toContain('完成会话持久化')
    expect(db.select().from(generationMessageParts).where(eq(generationMessageParts.sessionId, session.id)).all().at(-1)?.partType).toBe('proposal-accepted')
    expect(db.select().from(generationSessions).where(eq(generationSessions.id, session.id)).get()?.baselineFinalContent).toBe(proposal.content)

    const added = await appendPlanOverride({
      reportId: report.id,
      sessionId: session.id,
      action: 'keep',
      text: '安排发布复盘',
    })
    await appendPlanOverride({ reportId: report.id, sessionId: session.id, itemId: added.itemId, action: 'rewrite', text: '完成发布复盘' })
    await appendPlanOverride({ reportId: report.id, sessionId: session.id, itemId: added.itemId, action: 'drop' })
    await appendPlanOverride({ reportId: report.id, sessionId: session.id, itemId: added.itemId, action: 're-add' })
    const restored = await getGenerationSessionDetail(report.id, session.id)
    expect(restored?.planOverrides.map((item) => ({ itemId: item.itemId, action: item.action, source: item.source, replacementText: item.replacementText }))).toEqual([
      { itemId: 'session-item-1', action: 'keep', source: 'this-week-new', replacementText: '安排发布复盘' },
      { itemId: 'session-item-1', action: 'rewrite', source: 'this-week-new', replacementText: '完成发布复盘' },
      { itemId: 'session-item-1', action: 'drop', source: 'this-week-new', replacementText: null },
      { itemId: 'session-item-1', action: 're-add', source: 'this-week-new', replacementText: null },
    ])

    db.delete(generationPlanOverrides).where(eq(generationPlanOverrides.sessionId, session.id)).run()
    db.delete(generationProposals).where(eq(generationProposals.sessionId, session.id)).run()
    db.delete(generationMessageParts).where(eq(generationMessageParts.sessionId, session.id)).run()
    db.delete(generationTurns).where(eq(generationTurns.sessionId, session.id)).run()
    db.delete(generationSessions).where(eq(generationSessions.id, session.id)).run()
    db.delete(reportVariants).where(eq(reportVariants.reportId, report.id)).run()
    db.delete(reports).where(eq(reports.id, report.id)).run()
  })
})
