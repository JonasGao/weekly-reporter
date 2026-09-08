import type { APIRequestContext } from '@playwright/test'
import { test, expect } from './app-fixture'
import { disposeCarryForward, seedCarryForward } from './carry-forward-fixtures'
import { SCRIPTED_AI_URL, scriptedInstruction } from './scripted-ai'

function proposalStep(input: {
  content: string
  changes: string[]
  handling: string[]
  plan: Record<string, unknown>
}) {
  return {
    kind: 'stream' as const,
    reasoning: '这是供应商显式 reasoning，不得被推断或复制到公开生成摘要。',
    text: '已准备只读候选终版。',
    toolCalls: [{
      name: 'propose_final_report',
      arguments: {
        content: input.content,
        summary: input.changes,
        publicSummary: { modelHandling: input.handling },
        plan: input.plan,
      },
    }],
  }
}

async function configureAI(request: APIRequestContext) {
  const response = await request.put('/api/settings/ai', {
    data: { protocol: 'openai-compatible', apiUrl: SCRIPTED_AI_URL, apiKey: 'e2e-scripted', model: 'e2e-scripted' },
  })
  expect(response.ok()).toBeTruthy()
}

async function createSession(request: APIRequestContext, reportId: number) {
  const response = await request.post(`/api/reports/${reportId}/generation-sessions`, {
    data: { variant: 'personal', templateId: 'official-general' },
  })
  expect(response.status()).toBe(201)
  return await response.json() as { id: number }
}

test.describe('提案评审与公开生成摘要', () => {
  test.setTimeout(60_000)

  test('在只读评审中恢复摘要、来源与三种视图，并采用到当前编辑基线', async ({ page, request }) => {
    const marker = `proposal-review-${Date.now()}`
    const fixture = await seedCarryForward(request, marker)
    try {
      await configureAI(request)
      const session = await createSession(request, fixture.targetReportId)
      const initialDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const candidateId = (await initialDetail.json()).carryForwardSnapshot.candidates[0].candidateId as string
      const firstContent = `# 本周完成\n\n- ${marker} current source fact\n\n## 下周计划\n- ${marker} personal carry`
      const secondContent = `# 本周完成\n\n- 已完成：${marker} current source fact\n\n## 下周计划\n- ${marker} personal carry\n- 整理公开评审结论`
      const instruction = scriptedInstruction('生成并评审两轮完整提案', {
        steps: [
          proposalStep({
            content: firstContent,
            changes: ['建立首个当前编辑基线'],
            handling: ['仅依据当前受众的周报原稿整理本周事实。'],
            plan: {
              judgments: [{ candidateId, judgment: 'carry', reason: '上一周期事项仍需继续推进。' }],
              items: [{ text: `${marker} personal carry`, source: 'carry-forward', candidateId }],
            },
          }),
          proposalStep({
            content: secondContent,
            changes: [
              '调整本周完成表述',
              '补充下一步评审计划',
              `不得保留的历史正文：${marker} personal carry`,
              'c'.repeat(281),
              ...Array.from({ length: 10 }, (_, index) => `公开变更 ${index + 1}`),
            ],
            handling: [
              '仅依据当前受众的周报原稿重写本周完成内容。',
              '计划结转仅作为历史参考，不作为本周已发生事实。',
            ],
            plan: {
              items: [
                { text: '整理公开评审结论', source: 'user-goal' },
                { text: `${marker} personal carry`, source: 'carry-forward', candidateId },
                { text: '补充评审截图', source: 'current-fact' },
                { text: '核对 Markdown 源码', source: 'current-fact' },
                { text: '记录采用结果', source: 'current-fact' },
                { text: '归档额外说明', source: 'current-fact' },
              ],
            },
          }),
        ],
      })

      await page.goto(`/edit/${fixture.targetReportId}`)
      const composer = page.getByPlaceholder('Ask AI to revise, answer a question, or submit the current version...')
      await composer.fill(instruction)
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      const review = page.getByRole('complementary', { name: 'Read-only proposal review' })
      await expect(review.getByText('Pending review')).toBeVisible({ timeout: 30_000 })
      await review.getByRole('button', { name: 'Accept and save final version' }).click()
      await expect(review.getByText('Accepted')).toBeVisible()

      await composer.fill('基于当前编辑基线提交第二轮完整提案')
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(review.getByText('Pending review')).toBeVisible({ timeout: 30_000 })
      await expect(review.getByRole('heading', { name: 'Public generation summary' })).toBeVisible()
      await expect(review.getByText('仅依据当前受众的周报原稿重写本周完成内容。')).toBeVisible()
      await expect(review.getByText('carry-forward', { exact: true }).first()).toBeVisible()
      await expect(review.getByText('本周新增', { exact: true }).first()).toBeVisible()
      await expect(review.getByText('Plan override conclusions')).toBeVisible()
      await expect(review.getByText('none', { exact: true }).first()).toBeVisible()
      await expect(review.getByText('next-week-plan-structure/v1')).toBeVisible()
      await expect(review.getByText('required · present')).toBeVisible()
      await expect(review.locator('textarea, input, [contenteditable="true"]')).toHaveCount(0)

      await review.getByRole('tab', { name: 'Markdown source' }).click()
      await expect(review.getByTestId('proposal-markdown-source')).toContainText('# 本周完成')
      await review.getByRole('tab', { name: 'Difference' }).click()
      await expect(review.locator('[data-diff-type="remove"]').filter({ hasText: `${marker} current source fact` })).toHaveCount(1)
      await expect(review.locator('[data-diff-type="add"]').filter({ hasText: `已完成：${marker} current source fact` })).toHaveCount(1)
      await review.getByRole('tab', { name: 'Rendered preview' }).click()
      await expect(review.getByRole('heading', { name: '本周完成' })).toBeVisible()

      const detailResponse = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const detail = await detailResponse.json()
      const proposal = detail.proposals.at(-1)
      expect(proposal.baselineContent).toBe(firstContent)
      expect(proposal.publicSummary).toMatchObject({
        version: 1,
        modelHandling: [
          '仅依据当前受众的周报原稿重写本周完成内容。',
          '计划结转仅作为历史参考，不作为本周已发生事实。',
        ],
        planOverrideConclusions: [],
        toolStatuses: [{ toolName: 'propose_final_report', status: 'succeeded', detail: 'proposal-created' }],
        failureStates: [],
        templateSection: { policy: 'required', status: 'present' },
        structureCompleteness: { ruleVersion: 'next-week-plan-structure/v1', status: 'satisfied' },
        factBoundary: {
          currentWeekFacts: 'report-source-draft-only',
          historicalReferences: 'untrusted',
          hiddenReasoning: 'none',
          summaryAsFact: 'none',
          scoringInput: 'none',
        },
      })
      expect(proposal.publicSummary.changeSummary).toHaveLength(12)
      expect(proposal.publicSummary.changeSummary).toEqual(expect.arrayContaining(['调整本周完成表述', '补充下一步评审计划']))
      expect(proposal.publicSummary.changeSummary[2]).toHaveLength(280)
      expect(proposal.publicSummary.planItems.map((item: { source: string }) => item.source)).toEqual(expect.arrayContaining(['carry-forward', 'this-week-new']))
      expect(proposal.publicSummary.planJudgments[0]).toMatchObject({ candidateId, judgment: 'carry', reason: '上一周期事项仍需继续推进。' })
      expect(proposal.publicSummary.historicalReferences[0]).toMatchObject({
        title: `${marker} previous cycle`,
        audience: 'personal',
        finalStatus: 'current',
        trust: 'historical-reference-untrusted',
      })
      expect(proposal.publicSummary.truncationStates[0]).toMatchObject({ scope: 'next-week-plan', omittedCount: 1 })
      expect(proposal.publicSummary.truncationStates[1]).toMatchObject({ scope: 'proposal-change-summary', omittedCount: 2 })
      expect(JSON.stringify(proposal.publicSummary)).not.toContain(`${marker} personal final`)
      expect(JSON.stringify(proposal.publicSummary.changeSummary)).not.toContain(`${marker} personal carry`)
      expect(JSON.stringify(proposal.publicSummary)).not.toContain('这是供应商显式 reasoning')

      await page.reload()
      const restoredReview = page.getByRole('complementary', { name: 'Read-only proposal review' })
      await expect(restoredReview.getByText('Pending review')).toBeVisible({ timeout: 30_000 })
      await expect(restoredReview.getByText('补充下一步评审计划')).toBeVisible()
      await expect(restoredReview.getByText('carry-forward', { exact: true }).first()).toBeVisible()
      page.once('dialog', (dialog) => dialog.accept())
      await restoredReview.getByRole('button', { name: 'Accept and save final version' }).click()
      await expect(restoredReview.getByText('Accepted')).toBeVisible()

      const acceptedReport = await request.get(`/api/reports/${fixture.targetReportId}`)
      const acceptedVariant = (await acceptedReport.json()).variants.find((item: { variant: string }) => item.variant === 'personal')
      expect(acceptedVariant).toMatchObject({ finalContent: proposal.content, acceptedProposalId: proposal.id })
      expect(['pending', 'scoring', 'completed']).toContain(acceptedVariant.scoreStatus)
      const acceptedDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const acceptedBody = await acceptedDetail.json()
      expect(acceptedBody.baselineFinalContent).toBe(proposal.content)
      expect(acceptedBody.proposals.at(-1).status).toBe('accepted')
      expect(acceptedBody.messages.at(-1)).toMatchObject({ partType: 'proposal-accepted', data: { proposalId: proposal.id } })
    } finally {
      await disposeCarryForward(request, fixture)
    }
  })

  test('原稿版本变化时采用失败且不会部分更新终版', async ({ request }) => {
    const marker = `proposal-conflict-${Date.now()}`
    const fixture = await seedCarryForward(request, marker, 'empty')
    try {
      await configureAI(request)
      const session = await createSession(request, fixture.targetReportId)
      const stream = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}/turns`, {
        data: {
          message: scriptedInstruction('创建等待采用的提案', {
            steps: [proposalStep({
              content: `# 本周完成\n\n- ${marker} current source fact\n\n## 下周计划\n\n（暂无可用的下周计划事项）`,
              changes: ['生成等待采用的完整提案'],
              handling: ['仅使用当前周报原稿。'],
              plan: { items: [] },
            })],
          }),
        },
      })
      expect(stream.ok()).toBeTruthy()
      const detail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const proposal = (await detail.json()).proposals[0]
      const proposalId = proposal.id as number
      expect(proposal.publicSummary).toMatchObject({
        modelHandling: ['仅使用当前周报原稿。'],
        planJudgments: [],
        planOverrideConclusions: [],
        planItems: [],
        historicalReferences: [],
        failureStates: [{
          scope: 'proposal-next-week-plan',
          code: 'PROPOSAL_PLAN_PARSE_FAILED',
          message: 'The “下周计划” section contains no recognizable -, * or + unordered list.',
        }],
        truncationStates: [],
        changeSummary: ['生成等待采用的完整提案'],
      })
      const regenerated = await request.post(`/api/reports/${fixture.targetReportId}/regenerate-source`)
      expect(regenerated.ok()).toBeTruthy()

      const acceptance = await request.post(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}/proposals/${proposalId}/accept`)
      expect(acceptance.status()).toBe(409)
      expect((await acceptance.json()).code).toBe('SOURCE_REVISION_CONFLICT')
      const report = await request.get(`/api/reports/${fixture.targetReportId}`)
      const personal = (await report.json()).variants.find((item: { variant: string }) => item.variant === 'personal')
      expect(personal.finalContent).toBeNull()
      expect(personal.acceptedProposalId).toBeNull()
      const staleDetail = await request.get(`/api/reports/${fixture.targetReportId}/generation-sessions/${session.id}`)
      const staleBody = await staleDetail.json()
      expect(staleBody.sourceIsCurrent).toBe(false)
      expect(staleBody.proposals[0].status).toBe('pending')
      expect(staleBody.baselineFinalContent).toBeNull()
    } finally {
      await disposeCarryForward(request, fixture)
    }
  })
})
