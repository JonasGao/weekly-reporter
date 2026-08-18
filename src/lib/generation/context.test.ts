import { describe, expect, it } from 'vitest'
import {
  buildEffectiveGenerationSystemPrompt,
  buildModelSystemContext,
  buildSourceOverview,
} from './context'

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
})
