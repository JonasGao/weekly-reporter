import type { APIRequestContext } from '@playwright/test'
import { test, expect } from './app-fixture'
import { disposeCarryForward, seedCarryForward } from './carry-forward-fixtures'
import { SCRIPTED_AI_URL, scriptedInstruction } from './scripted-ai'

function proposalStep(content: string, candidateId: string, planItem?: string) {
  return {
    kind: 'stream' as const,
    text: '已按当前会话事实提交计划提案。',
    toolCalls: [{
      name: 'propose_final_report',
      arguments: {
        content,
        summary: ['应用当前会话的计划覆盖记录'],
        plan: {
          judgments: [{ candidateId, judgment: 'carry', reason: '模型判断该事项仍需推进' }],
          items: [{ text: planItem ?? (content.includes('AI 补充事项') ? 'AI 补充事项' : '模型提交的结转事项'), source: 'current-fact' }],
        },
      },
    }],
  }
}

async function createSession(request: APIRequestContext, reportId: number) {
  const response = await request.post(`/api/reports/${reportId}/generation-sessions`, {
    data: { variant: 'personal', templateId: 'official-general' },
  })
  expect(response.status()).toBe(201)
  return await response.json() as { id: number; carryForwardSnapshot: { candidates: Array<{ candidateId: string; text: string }> } }
}

async function configureAI(request: APIRequestContext) {
  const response = await request.put('/api/settings/ai', {
    data: { protocol: 'openai-compatible', apiUrl: SCRIPTED_AI_URL, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
  })
  expect(response.ok()).toBeTruthy()
}

test.describe('跨轮次计划覆盖记录', () => {
  test.setTimeout(90_000)

  test('drop 不回归，rewrite/re-add/重载/采用后继续生成均持久，并隔离新会话', async ({ page, request }) => {
    const marker = `plan-overrides-${Date.now()}`
    const rewritten = `${marker} rewritten remaining action`
    const newItem = `${marker} this-week addition`
    const fixture = await seedCarryForward(request, marker)
    try {
      await configureAI(request)
      const session = await createSession(request, fixture.targetReportId)
      const candidate = session.carryForwardSnapshot.candidates[0]
      const original = candidate.text
      const paraphrased = '与客户敲定验收日期'
      const content = `# 本周完成\n\n- ${marker} current source fact\n\n## 下周计划\n- ${original}`
      const scenario = scriptedInstruction('验证计划覆盖记录', {
        steps: [
          proposalStep(content, candidate.candidateId),
          proposalStep(content.replace(original, paraphrased), candidate.candidateId, paraphrased),
          proposalStep(`${content}\n- AI 补充事项`, candidate.candidateId),
          proposalStep(content, candidate.candidateId),
        ],
      })

      await page.goto(`/edit/${fixture.targetReportId}`)
      await page.getByRole('button', { name: 'Personal' }).click()
      const overrides = page.getByRole('region', { name: 'Plan overrides' })
      const candidateRow = overrides.locator(`[data-plan-item-id="${candidate.candidateId}"]`)
      await candidateRow.getByRole('button', { name: 'Keep' }).click()
      await expect(candidateRow.getByText(/keep → included/)).toBeVisible()
      await candidateRow.getByRole('button', { name: 'Drop' }).click()
      await expect(candidateRow.getByText(/drop → excluded/)).toBeVisible()

      const composer = page.getByPlaceholder('Ask AI to revise, answer a question, or submit the current version...')
      const review = page.getByRole('complementary', { name: 'Read-only proposal review' })
      await composer.fill(scenario)
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(review.getByText('Pending review')).toBeVisible({ timeout: 30_000 })
      await review.getByRole('tab', { name: 'Markdown source' }).click()
      await expect(review.getByTestId('proposal-markdown-source')).not.toContainText(original)
      await expect(review.getByText(new RegExp(`\\[${candidate.candidateId}\\] drop · excluded · carry-forward`))).toBeVisible()

      await candidateRow.getByRole('button', { name: 'Re-add' }).click()
      await expect(review.getByText('Superseded')).toBeVisible()
      await expect(review.getByRole('button', { name: 'Accept and save final version' })).toHaveCount(0)
      await candidateRow.getByRole('button', { name: 'Drop' }).click()

      await composer.fill('再次生成，不得以同义改写恢复已 drop 的事项')
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(review.getByText('Pending review')).toBeVisible({ timeout: 30_000 })
      await review.getByRole('tab', { name: 'Markdown source' }).click()
      await expect(review.getByTestId('proposal-markdown-source')).not.toContainText(original)
      await expect(review.getByTestId('proposal-markdown-source')).not.toContainText(paraphrased)

      await candidateRow.getByRole('button', { name: 'Re-add' }).click()
      await expect(candidateRow.getByText(/re-add → included/)).toBeVisible()
      await candidateRow.getByRole('button', { name: 'Rewrite' }).click()
      await candidateRow.getByRole('textbox', { name: `Rewrite ${candidate.candidateId}` }).fill(rewritten)
      await candidateRow.getByRole('button', { name: 'Save rewrite' }).click()
      await expect(candidateRow.getByText(rewritten, { exact: true })).toBeVisible()
      await overrides.getByRole('textbox', { name: 'New this-week plan item' }).fill(newItem)
      await overrides.getByRole('button', { name: 'Add item' }).click()
      await expect(overrides.getByText(newItem, { exact: true })).toBeVisible()

      await composer.fill('生成采用 rewrite 与本周新增事项的提案')
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(review.getByText('Pending review')).toBeVisible({ timeout: 30_000 })
      await review.getByRole('tab', { name: 'Markdown source' }).click()
      const proposalSource = review.getByTestId('proposal-markdown-source')
      await expect(proposalSource).toContainText(newItem)
      await expect(proposalSource).toContainText(rewritten)
      await expect(proposalSource).not.toContainText(original)
      await expect(review.getByText('user rewrite', { exact: true }).first()).toBeVisible()
      await expect(review.getByText('本周新增', { exact: true }).first()).toBeVisible()
      await expect(review.locator('textarea, input, [contenteditable="true"]')).toHaveCount(0)

      const beforeReload = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const beforeReloadBody = await beforeReload.json()
      expect(beforeReloadBody.planOverrides.map((item: { action: string }) => item.action)).toEqual(['keep', 'drop', 're-add', 'drop', 're-add', 'rewrite', 'keep'])
      expect(beforeReloadBody.planOverrides.every((item: { itemId?: string; source?: string; createdAt?: string }) => item.itemId && item.source && item.createdAt)).toBe(true)
      expect(beforeReloadBody.planOverrideState).toEqual(expect.arrayContaining([
        expect.objectContaining({ itemId: candidate.candidateId, effectiveText: rewritten, latestAction: 'rewrite', source: 'carry-forward' }),
        expect.objectContaining({ itemId: 'session-item-1', effectiveText: newItem, latestAction: 'keep', source: 'this-week-new' }),
      ]))

      await page.reload()
      await page.getByRole('button', { name: 'Personal' }).click()
      await expect(page.getByRole('region', { name: 'Plan overrides' }).getByText(rewritten, { exact: true })).toBeVisible()
      await expect(page.getByText('Append-only override history (7)')).toBeVisible()
      await expect(page.getByRole('complementary', { name: 'Read-only proposal review' }).getByText('Pending review')).toBeVisible()

      const isolatedSession = await createSession(request, fixture.targetReportId)
      const isolatedDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${isolatedSession.id}`)
      expect((await isolatedDetail.json()).planOverrides).toEqual([])
      const isolatedStream = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${isolatedSession.id}/turns`, {
        data: {
          message: scriptedInstruction('新会话只使用自己的事实', {
            steps: [proposalStep(content, isolatedSession.carryForwardSnapshot.candidates[0].candidateId)],
          }),
        },
      })
      expect(isolatedStream.ok()).toBeTruthy()
      const isolatedAfter = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${isolatedSession.id}`)
      const isolatedProposal = (await isolatedAfter.json()).proposals.at(-1)
      expect(isolatedProposal.content).toContain(original)
      expect(isolatedProposal.content).not.toContain(rewritten)
      expect(isolatedProposal.content).not.toContain(newItem)

      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('complementary', { name: 'Read-only proposal review' }).getByRole('button', { name: 'Accept and save final version' }).click()
      await expect(page.getByRole('complementary', { name: 'Read-only proposal review' }).getByText('Accepted')).toBeVisible()
      await composer.fill('采用后继续生成，仍保留全部覆盖')
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(review.getByText('Pending review')).toBeVisible({ timeout: 30_000 })
      await review.getByRole('tab', { name: 'Markdown source' }).click()
      await expect(review.getByTestId('proposal-markdown-source')).toContainText(rewritten)
      await expect(review.getByTestId('proposal-markdown-source')).toContainText(newItem)
      await expect(review.getByTestId('proposal-markdown-source')).not.toContainText(original)

      const restored = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const restoredBody = await restored.json()
      expect(restoredBody.planOverrides).toEqual(beforeReloadBody.planOverrides)
      expect(restoredBody.proposals.at(-1).publicSummary.planOverrideConclusions).toEqual([
        { itemId: candidate.candidateId, action: 'rewrite', result: 'included', replacementText: rewritten, source: 'carry-forward' },
        { itemId: 'session-item-1', action: 'keep', result: 'included', replacementText: newItem, source: 'this-week-new' },
      ])
    } finally {
      await disposeCarryForward(request, fixture)
    }
  })
})
