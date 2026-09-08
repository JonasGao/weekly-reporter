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
  items: [{ text: '继续推进计划', source: 'carry-forward', candidateId: 'carry-1' }],
  judgments: [{ candidateId: 'carry-1', judgment: 'carry', reason: '尚未完成', remainingAction: null }],
  truncatedCount: 0,
  warnings: [],
}

describe('public generation summary', () => {
  it('keeps all contract fields explicit and removes copied historical body text', () => {
    const summary = buildPublicGenerationSummary({
      explicit: { modelHandling: ['按原稿组织事实。', '引用不得复制的历史计划正文作为事实。'] },
      changeSummary: [],
      planState,
      carryForwardSnapshot: snapshot,
      templatePolicy: 'required',
    })

    expect(summary.modelHandling).toEqual(['按原稿组织事实。'])
    expect(summary.planOverrideConclusions).toEqual([])
    expect(summary.failureStates).toEqual([])
    expect(summary.truncationStates).toEqual([])
    expect(summary.changeSummary).toEqual([])
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
})
