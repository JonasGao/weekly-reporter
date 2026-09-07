import { test, expect } from './app-fixture'
import type { APIRequestContext } from '@playwright/test'
import { disposeCarryForward, seedCarryForward } from './carry-forward-fixtures'

async function createSession(request: APIRequestContext, reportId: number, variant: 'leadership' | 'personal') {
  const response = await request.post(`/api/reports/${reportId}/generation-sessions`, {
    data: { variant, templateId: 'official-general' },
  })
  expect(response.status()).toBe(201)
  return await response.json() as { id: number; carryForwardSnapshot: CarryForwardSnapshot }
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
