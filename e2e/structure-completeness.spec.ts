import { test, expect } from './generation-fixtures'
import { SCRIPTED_AI_URL, scriptedInstruction } from './scripted-ai'
import type { APIRequestContext } from '@playwright/test'

function proposalStep(content: string) {
  return {
    kind: 'stream' as const,
    toolCalls: [{
      name: 'propose_final_report',
      arguments: { content, summary: ['提交完整终版候选'] },
    }],
  }
}

async function createAndAccept(input: {
  request: APIRequestContext
  reportId: number
  variant: 'leadership' | 'personal'
  templateId: string
  content: string
}) {
  const sessionResponse = await input.request.post(`/api/reports/${input.reportId}/generation-sessions`, {
    data: { variant: input.variant, templateId: input.templateId },
  })
  expect(sessionResponse.status()).toBe(201)
  const session = await sessionResponse.json() as { id: number }
  const turn = await input.request.post(`/api/reports/${input.reportId}/generation-sessions/${session.id}/turns`, {
    data: { message: scriptedInstruction('提交候选终版', { steps: [proposalStep(input.content)] }) },
  })
  expect(turn.ok()).toBeTruthy()
  const detail = await input.request.get(`/api/reports/${input.reportId}/generation-sessions/${session.id}`)
  const proposal = (await detail.json()).proposals.at(-1) as { id: number; content: string }
  expect(proposal).toBeTruthy()
  const accepted = await input.request.post(`/api/reports/${input.reportId}/generation-sessions/${session.id}/proposals/${proposal.id}/accept`)
  expect(accepted.ok()).toBeTruthy()
  return { sessionId: session.id, proposal, accepted: await accepted.json() }
}

test('结构完整度按采用时模板契约评分，失败可重试且受众隔离', async ({ page, request, reportId }) => {
  const template = await request.post('/api/templates', {
    data: { name: `forbidden-${Date.now()}`, content: '本模板明确禁止下周计划章节。', aiStyle: 'formal' },
  })
  expect(template.status()).toBe(201)
  const templateRecord = (await template.json()).template as { id: number; name: string }
  const forbiddenTemplateId = `user-${templateRecord.id}`

  try {
    await request.put('/api/settings/ai', {
      data: { protocol: 'openai-compatible', apiUrl: SCRIPTED_AI_URL, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
    })

    const emptyPersonal = await createAndAccept({
      request,
      reportId,
      variant: 'personal',
      templateId: 'official-general',
      content: '# 本周完成\n\n- 个人版事实',
    })
    expect(emptyPersonal.proposal.content).toContain('（暂无可用的下周计划事项）')
    expect(emptyPersonal.accepted.variant.structureCompletenessRule).toEqual({
      version: 'next-week-plan-structure/v1', nextWeekPlan: 'required',
    })

    const forbiddenPersonal = await createAndAccept({
      request,
      reportId,
      variant: 'personal',
      templateId: forbiddenTemplateId,
      content: '# 本周完成\n\n- 旧模板个人版事实\n\n## 下周计划\n- 不应保留',
    })
    expect(forbiddenPersonal.proposal.content).not.toContain('下周计划')
    expect(forbiddenPersonal.accepted.variant.structureCompletenessRule).toEqual({
      version: 'next-week-plan-structure/v1', nextWeekPlan: 'forbidden',
    })

    const updatedTemplate = await request.put(`/api/templates/${templateRecord.id}`, {
      data: { name: templateRecord.name, content: '现在允许扩展并要求下周计划。', description: '', tags: '', aiStyle: 'formal' },
    })
    expect(updatedTemplate.ok()).toBeTruthy()

    const leadership = await createAndAccept({
      request,
      reportId,
      variant: 'leadership',
      templateId: 'official-general',
      content: '# 本周完成\n\n- 领导版事实\n\n## 下周计划\n- 领导版下一步',
    })
    expect(leadership.accepted.variant.structureCompletenessRule.nextWeekPlan).toBe('required')

    const report = await request.get(`/api/reports/${reportId}`)
    const variants = (await report.json()).variants as Array<{ variant: string; finalContent: string; structureCompletenessRule: unknown }>
    const personal = variants.find((variant) => variant.variant === 'personal')!
    const leadershipVariant = variants.find((variant) => variant.variant === 'leadership')!
    expect(personal.finalContent).toContain('旧模板个人版事实')
    expect(personal.finalContent).not.toContain('领导版事实')
    expect(personal.structureCompletenessRule).toEqual({ version: 'next-week-plan-structure/v1', nextWeekPlan: 'forbidden' })
    expect(leadershipVariant.finalContent).toContain('领导版事实')
    expect(leadershipVariant.finalContent).not.toContain('旧模板个人版事实')

    await request.put('/api/settings/ai', {
      data: { protocol: 'openai-compatible', apiUrl: `${SCRIPTED_AI_URL}/fail-score`, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
    })
    const retry = await request.post(`/api/reports/${reportId}/rescore`, { data: { variant: 'personal' } })
    expect(retry.ok()).toBeTruthy()
    await expect.poll(async () => {
      const latest = await request.get(`/api/reports/${reportId}`)
      return ((await latest.json()).variants as Array<{ variant: string; scoreStatus: string }>).find((item) => item.variant === 'personal')?.scoreStatus
    }).toBe('failed')

    await request.put('/api/settings/ai', {
      data: { protocol: 'openai-compatible', apiUrl: SCRIPTED_AI_URL, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
    })
    const rescore = await request.post(`/api/reports/${reportId}/rescore`, { data: { variant: 'personal' } })
    expect(rescore.ok()).toBeTruthy()
    await expect.poll(async () => {
      const latest = await request.get(`/api/reports/${reportId}`)
      return ((await latest.json()).variants as Array<{ variant: string; scoreStatus: string }>).find((item) => item.variant === 'personal')?.scoreStatus
    }).toBe('completed')

    await page.goto(`/edit/${reportId}`)
    await page.getByRole('button', { name: 'Report content' }).click()
    await expect(page.getByText('旧模板个人版事实')).toBeVisible()
  } finally {
    await request.delete(`/api/templates/${templateRecord.id}`)
  }
})
