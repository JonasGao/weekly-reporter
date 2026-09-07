import { describe, expect, it } from 'vitest'
import {
  buildEffectiveGenerationSystemPrompt,
  buildCarryForwardContext,
  buildModelSystemContext,
  buildSourceOverview,
} from './context'
import { normalizeCarryForwardSnapshot } from './carry-forward'

describe('generation context', () => {
  it('creates a deterministic compact overview without replacing the full source', () => {
    const source = `- **weekly-reporter**
  - 完成流式生成接口
  - 修复生产数据库迁移
- 参加项目评审并确认下一步计划`

    expect(buildSourceOverview(source, 'leadership')).toBe(
      '领导版原稿共 3 条事件，涉及 1 个仓库/项目：weekly-reporter。\n1. 完成流式生成接口\n2. 修复生产数据库迁移\n3. 参加项目评审并确认下一步计划',
    )
  })

  it('keeps the complete source and template in model-only context', () => {
    const context = buildModelSystemContext({
      systemPrompt: 'SYSTEM',
      stylePrompt: 'STYLE',
      toolRules: 'TOOL',
      variant: 'personal',
      weekStart: '2026-08-10',
      weekEnd: '2026-08-16',
      templateName: '模板',
      templateContent: '# 本周成果',
      sourceDraft: '- 完整事实 A\n- 完整事实 B',
      latestProposalContent: '# 上一版',
    })

    expect(context).toContain('- 完整事实 A\n- 完整事实 B')
    expect(context).toContain('# 本周成果')
    expect(context).toContain('# 上一版')
  })

  it('makes the configured generation prompt visible inside the effective prompt', () => {
    const result = buildEffectiveGenerationSystemPrompt('只允许原稿事实')
    expect(result).toContain('只允许原稿事实')
    expect(result).toContain('propose_final_report')
  })

  it('labels the carry-forward input as untrusted historical reference', () => {
    const context = buildCarryForwardContext({
      ...normalizeCarryForwardSnapshot(null),
      status: 'found',
      source: {
        reportId: 12,
        title: 'Previous report',
        audience: 'personal',
        weekStart: '2026-08-03',
        weekEnd: '2026-08-09',
        finalStatus: 'current',
        acceptedProposalId: 4,
        updatedAt: '2026-08-09T00:00:00.000Z',
      },
      planText: '## 下周计划\n- Carry this item',
      parseStatus: 'found',
      parseReason: null,
      candidates: [{
        candidateId: 'carry-forward-test',
        text: 'Carry this item',
        normalizedText: 'carry this item',
        source: 'carry-forward',
        judgment: null,
        reason: null,
      }],
    })
    expect(context).toContain('历史参考·不可信')
    expect(context).toContain('carry-forward-test')
    expect(context).toContain('不是本周事实')
  })
})
