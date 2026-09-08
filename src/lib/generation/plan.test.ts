import { describe, expect, it } from 'vitest'
import { mergeProposalPlan, normalizePlanJudgments, type ProposalPlanInput } from './plan'
import { normalizeCarryForwardSnapshot } from './carry-forward-snapshot'

function snapshot() {
  return {
    ...normalizeCarryForwardSnapshot(null),
    status: 'found' as const,
    source: {
      reportId: 1,
      title: 'previous',
      audience: 'personal' as const,
      weekStart: '2026-08-03',
      weekEnd: '2026-08-09',
      finalStatus: 'current' as const,
      acceptedProposalId: 2,
      updatedAt: '2026-08-09T00:00:00.000Z',
    },
    candidates: [
      { candidateId: 'carry-a', text: '继续推进发布', normalizedText: '继续推进发布', source: 'carry-forward' as const, judgment: null, reason: null },
      { candidateId: 'carry-b', text: '完成已结束事项', normalizedText: '完成已结束事项', source: 'carry-forward' as const, judgment: null, reason: null },
    ],
  }
}

describe('generation plan merge', () => {
  it('records missing or partial judgments as uncertain and excludes them by default', () => {
    const judgments = normalizePlanJudgments(snapshot(), { judgments: [{ candidateId: 'carry-a', judgment: 'carry', reason: '仍未完成' }] })
    expect(judgments).toEqual([
      { candidateId: 'carry-a', judgment: 'carry', reason: '仍未完成', remainingAction: null },
      { candidateId: 'carry-b', judgment: 'uncertain', reason: '本轮未可靠判断，默认不自动结转。', remainingAction: null },
    ])
    const result = mergeProposalPlan({
      content: '# 周报\n\n## 下周计划\n- 完成已结束事项',
      templateContent: '包含下周计划',
      snapshot: snapshot(),
      existingJudgments: judgments,
    })
    expect(result.content).toContain('- 继续推进发布')
    expect(result.content).not.toContain('- 完成已结束事项')
    expect(result.state.judgments[1].judgment).toBe('uncertain')
  })

  it('uses fixed source priority, stable normalized deduplication, remaining actions, and truncation', () => {
    const plan: ProposalPlanInput = {
      judgments: [{ candidateId: 'carry-a', judgment: 'carry', reason: '只剩发布动作', remainingAction: '完成发布' }, { candidateId: 'carry-b', judgment: 'drop', reason: '已完成' }],
      items: [
        { text: '明确目标', source: 'user-goal' },
        { text: '明确目标 ', source: 'user-goal' },
        { text: '本周推导', source: 'current-fact' },
        { text: '基线事项', source: 'baseline' },
        { text: '第五项', source: 'user-goal' },
        { text: '第六项', source: 'current-fact' },
      ],
    }
    const result = mergeProposalPlan({
      content: '# 周报\n\n## 下周计划\n- 本周推导\n- 完成发布',
      templateContent: '允许扩展',
      snapshot: snapshot(),
      plan,
      baselineFinalContent: '## 下周计划\n- 基线事项',
    })
    expect(result.state.items.map((item) => item.text)).toEqual(['明确目标', '第五项', '完成发布', '本周推导', '第六项'])
    expect(result.state.items.every((item) => item.text !== '基线事项')).toBe(true)
    expect(result.state.truncatedCount).toBe(1)
    expect(result.state.items.find((item) => item.text === '完成发布')).toMatchObject({ source: 'carry-forward', candidateId: 'carry-a' })
    expect(result.state.warnings.join('\n')).toContain('截断')
  })

  it('appends an explicit empty plan, and omits one when the template forbids it', () => {
    const empty = mergeProposalPlan({ content: '# 周报', templateContent: '允许扩展', snapshot: { ...normalizeCarryForwardSnapshot(null), status: 'no-source' } })
    expect(empty.content).toContain('## 下周计划')
    expect(empty.content).toContain('暂无可用的下周计划事项')
    expect(empty.state.status).toBe('empty')

    const forbidden = mergeProposalPlan({ content: '# 周报\n\n## 下周计划\n- 不应出现', templateContent: '明确禁止下周计划章节', snapshot: snapshot() })
    expect(forbidden.content).not.toContain('下周计划')
    expect(forbidden.state).toMatchObject({ status: 'forbidden', section: 'omitted' })
  })

  it('keeps an append-only drop effective when a later AI judgment tries to carry the item', () => {
    const result = mergeProposalPlan({
      content: '# 周报\n\n## 下周计划\n- 继续推进发布',
      templateContent: '包含下周计划',
      snapshot: snapshot(),
      plan: {
        judgments: [
          { candidateId: 'carry-a', judgment: 'carry', reason: '模型再次建议结转' },
          { candidateId: 'carry-b', judgment: 'drop', reason: '已完成' },
        ],
        items: [{ text: '继续推进发布', source: 'carry-forward', candidateId: 'carry-a' }],
      },
      overrides: [{
        id: 1,
        itemId: 'carry-a',
        action: 'drop',
        replacementText: null,
        source: 'carry-forward',
        createdAt: new Date('2026-09-08T00:00:00.000Z'),
      }],
      baselineFinalContent: '## 下周计划\n- 继续推进发布',
    })

    expect(result.content).not.toContain('- 继续推进发布')
    expect(result.state.items).toEqual([])
    expect(result.state.overrideConclusions).toEqual([{
      itemId: 'carry-a',
      action: 'drop',
      result: 'excluded',
      replacementText: null,
      source: 'carry-forward',
    }])
  })

  it('replays rewrite, drop, explicit re-add, and new session items deterministically', () => {
    const overrides = [
      { id: 1, itemId: 'carry-a', action: 'rewrite' as const, replacementText: '完成灰度发布', source: 'carry-forward' as const, createdAt: '2026-09-08T00:00:00.000Z' },
      { id: 2, itemId: 'carry-a', action: 'drop' as const, replacementText: null, source: 'carry-forward' as const, createdAt: '2026-09-08T00:01:00.000Z' },
      { id: 3, itemId: 'carry-a', action: 're-add' as const, replacementText: null, source: 'carry-forward' as const, createdAt: '2026-09-08T00:02:00.000Z' },
      { id: 4, itemId: 'session-item-1', action: 'keep' as const, replacementText: '安排发布复盘', source: 'this-week-new' as const, createdAt: '2026-09-08T00:03:00.000Z' },
    ]
    const input = {
      content: '# 周报\n\n## 下周计划\n- 继续推进发布',
      templateContent: '包含下周计划',
      snapshot: snapshot(),
      plan: {
        judgments: [
          { candidateId: 'carry-a', judgment: 'drop' as const, reason: '模型误判为完成' },
          { candidateId: 'carry-b', judgment: 'drop' as const, reason: '已完成' },
        ],
      },
      overrides,
      baselineFinalContent: '## 下周计划\n- 基线中的稳定事项',
    }

    const first = mergeProposalPlan(input)
    const replay = mergeProposalPlan(input)

    expect(first.content).toBe(replay.content)
    expect(first.state.items).toEqual(replay.state.items)
    expect(first.state.items).toEqual([
      {
        text: '安排发布复盘',
        source: 'user-goal',
        candidateId: null,
        itemId: 'session-item-1',
        publicSource: 'this-week-new',
      },
      {
        text: '完成灰度发布',
        source: 'carry-forward',
        candidateId: 'carry-a',
        itemId: 'carry-a',
        publicSource: 're-add',
      },
      {
        text: '基线中的稳定事项',
        source: 'baseline',
        candidateId: null,
        itemId: null,
        publicSource: 'editing-baseline',
      },
    ])
    expect(first.state.overrideConclusions).toEqual([
      { itemId: 'carry-a', action: 're-add', result: 'included', replacementText: null, source: 'carry-forward' },
      { itemId: 'session-item-1', action: 'keep', result: 'included', replacementText: '安排发布复盘', source: 'this-week-new' },
    ])
  })
})
