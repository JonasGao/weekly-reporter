import { test, expect } from './app-fixture'
import type { APIRequestContext } from '@playwright/test'
import { disposeCarryForward, seedCarryForward } from './carry-forward-fixtures'
import { SCRIPTED_AI_URL, scriptedInstruction } from './scripted-ai'

function proposalStep(content: string, plan?: Record<string, unknown>) {
  return {
    kind: 'stream' as const,
    reasoning: '已核对计划来源与模板约束。',
    text: '已提交完整计划预览。',
    toolCalls: [{
      name: 'propose_final_report',
      arguments: {
        content,
        summary: ['保留当前原稿事实', '应用确定性计划合并规则'],
        ...(plan ? { plan } : {}),
      },
    }],
  }
}

async function createSession(request: APIRequestContext, reportId: number, templateId = 'official-general') {
  const response = await request.post(`/api/reports/${reportId}/generation-sessions`, { data: { variant: 'personal', templateId } })
  expect(response.status()).toBe(201)
  return await response.json() as { id: number }
}

test.describe('完整计划生成预览', () => {
  test('合并 carry、uncertain、去重、截断，并在采用前保持终版不变', async ({ request }) => {
    const marker = `plan-preview-${Date.now()}`
    const fixture = await seedCarryForward(request, marker)
    try {
      const config = await request.put('/api/settings/ai', {
        data: { protocol: 'openai-compatible', apiUrl: SCRIPTED_AI_URL, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
      })
      expect(config.ok()).toBeTruthy()
      const session = await createSession(request, fixture.targetReportId)
      const sessionDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const candidateId = (await sessionDetail.json()).carryForwardSnapshot.candidates[0].candidateId as string
      const before = await request.get(`/api/reports/${fixture.targetReportId}`)
      const beforeVariant = (await before.json()).variants.find((item: { variant: string }) => item.variant === 'personal')
      expect(beforeVariant.finalContent).toBeNull()
      const content = '# 本周完成\n\n- 当前事实\n\n## 下周计划\n- duplicate carry text\n- sixth item'
      const stream = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}/turns`, {
        data: { message: scriptedInstruction('提交完整预览', {
          steps: [proposalStep(content, {
            judgments: [{ candidateId, judgment: 'uncertain', reason: '返回不完整，无法确认' }],
            items: [
              { text: '明确用户目标', source: 'user-goal' },
              { text: '明确用户目标 ', source: 'user-goal' },
              { text: `${marker} personal carry`, source: 'carry-forward' },
              { text: '本周事实推导', source: 'current-fact' },
              { text: '第四项', source: 'current-fact' },
              { text: '第五项', source: 'current-fact' },
              { text: '第六项', source: 'current-fact' },
            ],
          })],
        }) },
      })
      expect(stream.ok()).toBeTruthy()
      const events = (await stream.text()).trim().split('\n').map((line) => JSON.parse(line) as { type: string; proposal?: { id: number } })
      const proposalId = events.find((event) => event.type === 'proposal')?.proposal?.id
      expect(proposalId).toBeTruthy()
      const detail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const body = await detail.json()
      expect(body.planJudgments).toHaveLength(1)
      expect(body.planJudgments[0]).toMatchObject({ judgment: 'uncertain', reason: '返回不完整，无法确认' })
      const proposal = body.proposals.find((item: { id: number }) => item.id === proposalId)
      expect(proposal.planState.status).toBe('included')
      expect(proposal.planState.items).toHaveLength(5)
      expect(proposal.planState.truncatedCount).toBeGreaterThan(0)
      expect(proposal.content).toContain('明确用户目标')
      expect(proposal.content).toContain('下周计划')
      const after = await request.get(`/api/reports/${fixture.targetReportId}`)
      expect((await after.json()).variants.find((item: { variant: string }) => item.variant === 'personal').finalContent).toBeNull()
    } finally {
      await disposeCarryForward(request, fixture)
    }
  })

  test('无来源追加空计划，模板禁止时记录章节禁止并省略章节', async ({ request }) => {
    const marker = `plan-empty-${Date.now()}`
    const fixture = await seedCarryForward(request, marker, 'empty')
    let templateId: string | null = null
    try {
      await request.put('/api/settings/ai', {
        data: { protocol: 'openai-compatible', apiUrl: SCRIPTED_AI_URL, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
      })
      const emptySession = await createSession(request, fixture.targetReportId)
      const emptyStream = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${emptySession.id}/turns`, {
        data: { message: scriptedInstruction('提交空计划预览', { steps: [proposalStep('# 本周完成\n\n- 已完成')] }) },
      })
      expect(emptyStream.ok()).toBeTruthy()
      const emptyDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${emptySession.id}`)
      const emptyProposal = (await emptyDetail.json()).proposals[0]
      expect(emptyProposal.planState.status).toBe('empty')
      expect(emptyProposal.content).toContain('暂无可用的下周计划事项')

      const template = await request.post('/api/templates', { data: { name: `${marker} forbidden`, content: '本模板明确禁止下周计划章节。', aiStyle: 'formal' } })
      expect(template.status()).toBe(201)
      templateId = `user-${(await template.json()).template.id}`
      const forbiddenSession = await createSession(request, fixture.targetReportId, templateId)
      const forbiddenStream = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${forbiddenSession.id}/turns`, {
        data: { message: scriptedInstruction('提交禁止计划预览', { steps: [proposalStep('# 本周完成\n\n- 已完成\n\n## 下周计划\n- 不应出现')] }) },
      })
      expect(forbiddenStream.ok()).toBeTruthy()
      const forbiddenDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${forbiddenSession.id}`)
      const forbiddenProposal = (await forbiddenDetail.json()).proposals[0]
      expect(forbiddenProposal.planState).toMatchObject({ status: 'forbidden', section: 'omitted' })
      expect(forbiddenProposal.content).not.toContain('下周计划')
    } finally {
      if (templateId) await request.delete(`/api/templates/${templateId.slice('user-'.length)}`)
      await disposeCarryForward(request, fixture)
    }
  })

  test('供应商失败也会持久化未决候选为 uncertain 且不阻断会话', async ({ request }) => {
    const marker = `plan-failure-${Date.now()}`
    const fixture = await seedCarryForward(request, marker)
    try {
      await request.put('/api/settings/ai', {
        data: { protocol: 'openai-compatible', apiUrl: SCRIPTED_AI_URL, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
      })
      const session = await createSession(request, fixture.targetReportId)
      const stream = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}/turns`, {
        data: { message: scriptedInstruction('模拟失败', { steps: [{ kind: 'failure', status: 502, message: 'scripted plan failure' }] }) },
      })
      expect(stream.ok()).toBeTruthy()
      const events = (await stream.text()).trim().split('\n').map((line) => JSON.parse(line) as { type: string })
      expect(events.map((event) => event.type)).toContain('error')
      const detail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const body = await detail.json()
      expect(body.planJudgments).toHaveLength(1)
      expect(body.planJudgments[0].judgment).toBe('uncertain')
      expect(body.proposals).toHaveLength(0)
    } finally {
      await disposeCarryForward(request, fixture)
    }
  })

  test('普通讨论轮次不消耗候选，后续提案仍可首次可靠判断 carry', async ({ request }) => {
    const marker = `plan-discussion-${Date.now()}`
    const fixture = await seedCarryForward(request, marker)
    try {
      await request.put('/api/settings/ai', {
        data: { protocol: 'openai-compatible', apiUrl: SCRIPTED_AI_URL, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
      })
      const session = await createSession(request, fixture.targetReportId)
      const detail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const candidateId = (await detail.json()).carryForwardSnapshot.candidates[0].candidateId as string
      const stream = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}/turns`, {
        data: { message: scriptedInstruction('先讨论，不提交提案', {
          steps: [
            { kind: 'stream', text: '可以继续核对计划来源。' },
            proposalStep('# 本周完成\n\n- 已核对\n\n## 下周计划\n- 继续推进', { judgments: [{ candidateId, judgment: 'carry', reason: '仍未完成' }] }),
          ],
        }) },
      })
      expect(stream.ok()).toBeTruthy()
      const firstDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      expect((await firstDetail.json()).planJudgments).toHaveLength(0)
      const second = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}/turns`, { data: { message: '现在提交完整预览' } })
      expect(second.ok()).toBeTruthy()
      const finalDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const body = await finalDetail.json()
      expect(body.planJudgments[0]).toMatchObject({ candidateId, judgment: 'carry' })
      expect(body.proposals.at(-1).planState.judgments[0].judgment).toBe('carry')
    } finally {
      await disposeCarryForward(request, fixture)
    }
  })
})
