import { test, expect } from './app-fixture'
import type { APIRequestContext } from '@playwright/test'
import { disposeCarryForward, seedCarryForward } from './carry-forward-fixtures'
import { SCRIPTED_AI_URL, scriptedInstruction } from './scripted-ai'

async function createSession(request: APIRequestContext, reportId: number, variant: 'leadership' | 'personal') {
  const response = await request.post(`/api/reports/${reportId}/generation-sessions`, {
    data: { variant, templateId: 'official-general' },
  })
  expect(response.status()).toBe(201)
  return await response.json() as { id: number; carryForwardSnapshot: CarryForwardSnapshot }
}

function streamProposal(content: string) {
  return {
    kind: 'stream' as const,
    reasoning: '已核对历史参考边界。',
    text: '已生成带计划结转的候选终版。',
    toolCalls: [{
      name: 'propose_final_report',
      arguments: { content, summary: ['保留当前原稿事实', '提交计划结转候选'] },
    }],
  }
}

interface CarryForwardSnapshot {
  status: string
  source: { reportId: number; audience: string; weekStart: string; weekEnd: string; finalStatus: string } | null
  planText: string | null
  parseStatus: string
  candidates: Array<{ candidateId: string; text: string; source: string }>
}

test.describe('计划结转快照', () => {
  test('隔离受众、冻结来源并在原稿变化后保持旧会话只读', async ({ page, request }) => {
    const marker = `carry-${Date.now()}`
    const fixture = await seedCarryForward(request, marker)
    try {
      const personal = await createSession(request, fixture.targetReportId, 'personal')
      const leadership = await createSession(request, fixture.targetReportId, 'leadership')
      expect(personal.carryForwardSnapshot).toMatchObject({ status: 'found', source: { audience: 'personal' }, parseStatus: 'found' })
      expect(leadership.carryForwardSnapshot).toMatchObject({ status: 'found', source: { audience: 'leadership' }, parseStatus: 'found' })
      expect(personal.carryForwardSnapshot.candidates[0].text).toContain('personal carry')
      expect(leadership.carryForwardSnapshot.candidates[0].text).toContain('leadership carry')
      expect(personal.carryForwardSnapshot.candidates[0].candidateId).toMatch(/^carry-forward-/)

      const aiConfig = await request.put('/api/settings/ai', {
        data: { protocol: 'openai-compatible', apiUrl: SCRIPTED_AI_URL, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
      })
      expect(aiConfig.ok()).toBeTruthy()
      const acceptedContent = `# ${marker} generated\n\n## 下周计划\n\n- ${marker} personal carried into proposal`
      const scriptedMessage = scriptedInstruction('请提交完整候选终版', {
        steps: [
          streamProposal(acceptedContent),
          { kind: 'stream', text: '继续编辑但不提交新的候选终版。' },
          { kind: 'stream', text: '继续编辑但不提交新的候选终版。' },
        ],
      })
      const stream = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${personal.id}/turns`, { data: { message: scriptedMessage } })
      expect(stream.ok()).toBeTruthy()
      const streamEvents = (await stream.text()).trim().split('\n').map((line) => JSON.parse(line) as { type: string; proposal?: { id: number } })
      expect(streamEvents.map((event) => event.type)).toEqual(expect.arrayContaining(['proposal', 'finish']))
      const proposalId = streamEvents.find((event) => event.type === 'proposal')?.proposal?.id
      expect(proposalId).toBeTruthy()
      const beforeAccept = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${personal.id}`)
      const beforeAcceptDetail = await beforeAccept.json() as { carryForwardSnapshot: CarryForwardSnapshot; proposals: Array<{ id: number }> }
      const accept = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${personal.id}/proposals/${proposalId}/accept`)
      expect(accept.ok()).toBeTruthy()
      const afterAccept = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${personal.id}`)
      const afterAcceptDetail = await afterAccept.json() as { carryForwardSnapshot: CarryForwardSnapshot; baselineFinalContent: string | null }
      expect(afterAcceptDetail.carryForwardSnapshot).toEqual(beforeAcceptDetail.carryForwardSnapshot)
      expect(afterAcceptDetail.baselineFinalContent).toBe(acceptedContent)

      await page.goto(`/edit/${fixture.targetReportId}`)
      await page.getByRole('button', { name: 'Personal' }).click()
      await expect(page.getByText(new RegExp(`${marker} personal carry`)).first()).toBeVisible()
      const composer = page.getByPlaceholder('Ask AI to revise, answer a question, or submit the current version...')
      await composer.fill('继续编辑当前终版，但不要刷新计划结转快照')
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(page.getByText('继续编辑但不提交新的候选终版。')).toBeVisible({ timeout: 30_000 })
      await page.reload()
      await page.getByRole('button', { name: 'Personal' }).click()
      await expect(page.getByText('继续编辑但不提交新的候选终版。')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(new RegExp(`${marker} personal carried into proposal`)).first()).toBeVisible()

      await page.goto(`/edit/${fixture.targetReportId}`)
      await expect(page.getByText('Plan carry-forward snapshot · 历史参考·不可信')).toBeVisible()
      await expect(page.getByText(new RegExp(`${marker} personal carry`)).first()).toBeVisible()
      await page.getByRole('button', { name: 'Leadership' }).click()
      await expect(page.getByText(new RegExp(`${marker} leadership carry`)).first()).toBeVisible()

      const previous = fixture.reportIds[0]
      const previousReport = await request.get(`/api/reports/${previous}`)
      const previousBundle = await previousReport.json() as { variants: Array<{ variant: string; sourceRevision: number }> }
      const previousPersonal = previousBundle.variants.find((variant) => variant.variant === 'personal')
      expect(previousPersonal).toBeTruthy()
      const changed = await request.put(`/api/reports/${previous}/final`, {
        data: { variant: 'personal', sourceRevision: previousPersonal?.sourceRevision, content: `# changed\n\n## 下周计划\n- ${marker} changed after session` },
      })
      expect(changed.ok()).toBeTruthy()
      const persisted = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${personal.id}`)
      const persistedDetail = await persisted.json() as { carryForwardSnapshot: CarryForwardSnapshot; sourceIsCurrent: boolean }
      expect(persistedDetail.sourceIsCurrent).toBe(true)
      expect(persistedDetail.carryForwardSnapshot.planText).toContain(`${marker} personal carry`)
      expect(persistedDetail.carryForwardSnapshot.planText).not.toContain('changed after session')

      const regenerate = await request.post(`/api/reports/${fixture.targetReportId}/regenerate-source`)
      expect(regenerate.ok()).toBeTruthy()
      const readonlyDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${personal.id}`)
      expect((await readonlyDetail.json()).sourceIsCurrent).toBe(false)
      const blockedTurn = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${personal.id}/turns`, { data: { message: 'must be rejected after source change' } })
      expect(blockedTurn.status()).toBe(409)
      expect(await blockedTurn.json()).toMatchObject({ code: 'SOURCE_REVISION_CONFLICT' })
      await page.reload()
      await expect(page.getByText('The source draft has changed. This session is retained for audit; create a new session from the latest draft.')).toBeVisible()
    } finally {
      await disposeCarryForward(request, fixture)
    }
  })

  test('没有精确来源时保存显式空快照并展示原因', async ({ page, request }) => {
    const fixture = await seedCarryForward(request, `carry-empty-${Date.now()}`, 'empty')
    try {
      const session = await createSession(request, fixture.targetReportId, 'personal')
      expect(session.carryForwardSnapshot).toMatchObject({ status: 'no-source', source: null, candidates: [], planText: null })
      await page.goto(`/edit/${fixture.targetReportId}`)
      await expect(page.getByText('Plan carry-forward snapshot · 历史参考·不可信')).toBeVisible()
      await expect(page.getByText('No exact previous-cycle source')).toBeVisible()
      await expect(page.getByText(/No exact previous-cycle current final report/)).toBeVisible()
    } finally {
      await disposeCarryForward(request, fixture)
    }
  })
})
