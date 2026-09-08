import { describe, expect, it } from 'vitest'
import { buildPublicGenerationSummary } from './public-summary'
import type { CarryForwardSnapshot } from './carry-forward-snapshot'
import type { PlanState } from './plan'

const snapshot: CarryForwardSnapshot = {
  version: 1,
  status: 'found',
  reason: null,
  capturedAt: '2026-09-08T00:00:00.000Z',
  source: {
    reportId: 4,
    title: '上一周期周报',
    audience: 'personal',
    weekStart: '2026-08-24',
    weekEnd: '2026-08-30',
    finalStatus: 'current',
    acceptedProposalId: 12,
    updatedAt: '2026-08-30T00:00:00.000Z',
  },
  planText: '## 下周计划\n- 不得复制的历史计划正文',
  parseStatus: 'found',
  parseReason: null,
  parseWarning: null,
  candidates: [{
    candidateId: 'carry-1',
    text: '不得复制的历史计划正文',
    normalizedText: '不得复制的历史计划正文',
    source: 'carry-forward',
    judgment: null,
    reason: null,
  }],
}

const planState: PlanState = {
  version: 1,
  status: 'included',
  section: 'present',
  items: [{ text: '继续推进计划', source: 'carry-forward', candidateId: 'carry-1', itemId: 'carry-1', publicSource: 'carry-forward' }],
  judgments: [{ candidateId: 'carry-1', judgment: 'carry', reason: '尚未完成', remainingAction: null }],
  overrideConclusions: [],
  truncatedCount: 0,
  warnings: [],
}

describe('public generation summary', () => {
  it('keeps all contract fields explicit and removes copied historical body text', () => {
    const summary = buildPublicGenerationSummary({
      explicit: { modelHandling: ['按原稿组织事实。', '引用不得复制的历史计划正文作为事实。'] },
      changeSummary: ['调整本周事实表达。', '变更：不得复制的历史计划正文。'],
      planState,
      carryForwardSnapshot: snapshot,
      templatePolicy: 'required',
    })

    expect(summary.modelHandling).toEqual(['按原稿组织事实。'])
    expect(summary.planOverrideConclusions).toEqual([])
    expect(summary.failureStates).toEqual([])
    expect(summary.truncationStates).toEqual([])
    expect(summary.changeSummary).toEqual(['调整本周事实表达。'])
    expect(summary.factBoundary).toMatchObject({
      currentWeekFacts: 'report-source-draft-only',
      historicalReferences: 'untrusted',
      hiddenReasoning: 'none',
      summaryAsFact: 'none',
      scoringInput: 'none',
    })
    expect(JSON.stringify(summary)).not.toContain(snapshot.planText)
    expect(JSON.stringify(summary)).not.toContain(snapshot.candidates[0].text)
  })

  it('records truncation when provider-authored public prose exceeds its bounds', () => {
    const summary = buildPublicGenerationSummary({
      explicit: {
        modelHandling: [
          'a'.repeat(281),
          ...Array.from({ length: 8 }, (_, index) => `handling-${index + 1}`),
        ],
      },
      changeSummary: [
        'b'.repeat(281),
        ...Array.from({ length: 12 }, (_, index) => `change-${index + 1}`),
      ],
      planState,
      carryForwardSnapshot: snapshot,
      templatePolicy: 'required',
    })

    expect(summary.modelHandling).toHaveLength(8)
    expect(summary.modelHandling[0]).toHaveLength(280)
    expect(summary.changeSummary).toHaveLength(12)
    expect(summary.changeSummary[0]).toHaveLength(280)
    expect(summary.truncationStates).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'model-handling', omittedCount: 2 }),
      expect.objectContaining({ scope: 'proposal-change-summary', omittedCount: 2 }),
    ]))
  })
})
