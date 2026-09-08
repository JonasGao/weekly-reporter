import type { APIRequestContext, Page } from '@playwright/test'
import { test, expect } from './generation-fixtures'
import { scriptedInstruction } from './scripted-ai'

interface QueryFixture {
  reportIds: number[]
  adjacentReportId?: number
  sameAudienceReportId: number
  crossAudienceReportId: number
}

interface ToolMessage {
  partType: string
  content: string | null
  data: {
    toolName?: string
    input?: Record<string, unknown>
    output?: {
      ok: boolean
      items: Array<Record<string, unknown>>
      nextCursor: string | null
      hasMore: boolean
      appliedFilters: Record<string, unknown>
    }
  } | null
}

async function seedQueryFixture(
  request: APIRequestContext,
  marker: string,
  targetReportId: number,
  mode: 'standard' | 'no-adjacent' = 'standard',
): Promise<QueryFixture> {
  const response = await request.post('/api/e2e/fixtures', {
    data: { action: 'report-query', marker, targetReportId, mode },
  })
  expect(response.status()).toBe(201)
  return response.json()
}

async function openSessionWithScript(
  page: Page,
  reportId: number,
  instruction: string,
) {
  await page.goto(`/edit/${reportId}`)
  await page.getByRole('button', { name: 'AI chat' }).click()
  await page.getByLabel('Template').selectOption('official-general')
  await page.getByLabel('Initial instruction (editable)').fill(instruction)
  await page.getByRole('button', { name: 'Create session and send' }).click()
}

async function latestSessionDetail(
  request: APIRequestContext,
  reportId: number,
) {
  const sessionsResponse = await request.get(`/api/reports/${reportId}/generation-sessions?variant=personal`)
  expect(sessionsResponse.ok()).toBeTruthy()
  const sessions = (await sessionsResponse.json()).sessions as Array<{ id: number }>
  expect(sessions).toHaveLength(1)
  const detailResponse = await request.get(`/api/reports/${reportId}/generation-sessions/${sessions[0].id}`)
  expect(detailResponse.ok()).toBeTruthy()
  return detailResponse.json() as Promise<{ messages: ToolMessage[] }>
}

test.describe('AI 查询周报列表', () => {
  test('默认查询只返回同受众已采用 current 终版并持久化公开审计', async ({ page, request, reportId, scenario }) => {
    const fixture = await seedQueryFixture(request, scenario, reportId)
    try {
      await openSessionWithScript(page, reportId, scriptedInstruction('查询可用历史周报列表', {
        steps: [
          {
            kind: 'stream',
            text: '我先查询同受众历史周报。',
            toolCalls: [{ name: 'query_report_list', arguments: {} }],
          },
          { kind: 'stream', text: '已查到同受众历史参考。' },
        ],
      }))

      await expect(page.getByText('已查到同受众历史参考。')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText('历史参考·不可信', { exact: true }).last()).toBeVisible()
      await expect(page.getByText(new RegExp(`${scenario} previous adjacent`)).last()).toBeVisible()
      await expect(page.getByText(new RegExp(`${scenario} personal history`)).last()).toBeVisible()
      await expect(page.getByText(new RegExp(`${scenario} leadership only`))).not.toBeVisible()

      const detail = await latestSessionDetail(request, reportId)
      const call = detail.messages.find((part) => part.partType === 'tool-call' && part.data?.toolName === 'query_report_list')
      const result = detail.messages.find((part) => part.partType === 'tool-result' && part.data?.toolName === 'query_report_list')
      expect(call?.data?.input).toEqual({})
      expect(result?.data?.output?.ok).toBe(true)
      expect(result?.data?.output?.appliedFilters).toEqual({
        query: null,
        title: null,
        startDate: null,
        endDate: null,
        statuses: ['current'],
        includeLegacy: false,
        relation: 'overlap',
        relativeToReportId: null,
        cursor: null,
        limit: 10,
      })
      const items = result?.data?.output?.items ?? []
      expect(items.map((item) => item.reportId)).toEqual(expect.arrayContaining([
        fixture.adjacentReportId,
        fixture.sameAudienceReportId,
      ]))
      expect(items.map((item) => item.reportId)).not.toContain(fixture.crossAudienceReportId)
      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual([
          'audience',
          'contentAvailable',
          'finalStatus',
          'isLegacy',
          'reportId',
          'title',
          'updatedAt',
          'weekEnd',
          'weekStart',
        ])
        expect(item.audience).toBe('personal')
        expect(item.finalStatus).toBe('current')
        expect(item.isLegacy).toBe(false)
      }
      expect(JSON.stringify(result?.data?.output)).not.toContain('sourceDraft')
      expect(JSON.stringify(result?.data?.output)).not.toContain('suggestions')
      expect(JSON.stringify(result?.data?.output)).not.toContain('scoreOverall')

      await page.reload()
      await page.getByRole('button', { name: 'AI chat' }).click()
      await expect(page.getByText('历史参考·不可信', { exact: true }).last()).toBeVisible()
      await expect(page.getByText(new RegExp(`${scenario} previous adjacent`)).last()).toBeVisible()
    } finally {
      const cleanup = await request.delete('/api/e2e/fixtures', { data: { reportIds: fixture.reportIds } })
      expect(cleanup.ok()).toBeTruthy()
    }
  })

  test('previous_adjacent 只返回会话周报的精确上一周期且不分页', async ({ page, request, reportId, scenario }) => {
    const fixture = await seedQueryFixture(request, scenario, reportId)
    try {
      await openSessionWithScript(page, reportId, scriptedInstruction('查询精确上一周期', {
        steps: [
          {
            kind: 'stream',
            toolCalls: [{
              name: 'query_report_list',
              arguments: {
                relation: 'previous_adjacent',
                relativeToReportId: reportId,
                query: 'ignored query',
                startDate: '1900-01-01',
                endDate: '1900-01-02',
                cursor: 'ignored cursor',
                limit: 20,
              },
            }],
          },
          { kind: 'stream', text: '精确上一周期查询完成。' },
        ],
      }))

      await expect(page.getByText('精确上一周期查询完成。')).toBeVisible({ timeout: 30_000 })
      const detail = await latestSessionDetail(request, reportId)
      const output = detail.messages.find((part) => part.partType === 'tool-result' && part.data?.toolName === 'query_report_list')?.data?.output
      expect(output?.ok).toBe(true)
      expect(output?.items.map((item) => item.reportId)).toEqual([fixture.adjacentReportId])
      expect(output?.hasMore).toBe(false)
      expect(output?.nextCursor).toBeNull()
      expect(output?.appliedFilters).toMatchObject({
        query: null,
        startDate: null,
        endDate: null,
        relation: 'previous_adjacent',
        relativeToReportId: reportId,
        cursor: null,
        limit: 1,
      })
    } finally {
      const cleanup = await request.delete('/api/e2e/fixtures', { data: { reportIds: fixture.reportIds } })
      expect(cleanup.ok()).toBeTruthy()
    }
  })

  test('previous_adjacent 无精确来源时成功返回空列表且不回退', async ({ page, request, reportId, scenario }) => {
    const fixture = await seedQueryFixture(request, scenario, reportId, 'no-adjacent')
    try {
      await openSessionWithScript(page, reportId, scriptedInstruction('查询不存在的精确上一周期', {
        steps: [
          {
            kind: 'stream',
            toolCalls: [{
              name: 'query_report_list',
              arguments: { relation: 'previous_adjacent', relativeToReportId: reportId },
            }],
          },
          { kind: 'stream', text: '没有精确上一周期，继续仅依据本周原稿。' },
        ],
      }))

      await expect(page.getByText('没有精确上一周期，继续仅依据本周原稿。')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText('未找到符合条件的历史周报', { exact: true })).toBeVisible()
      const detail = await latestSessionDetail(request, reportId)
      const output = detail.messages.find((part) => part.partType === 'tool-result' && part.data?.toolName === 'query_report_list')?.data?.output
      expect(output).toMatchObject({ ok: true, items: [], nextCursor: null, hasMore: false })
    } finally {
      const cleanup = await request.delete('/api/e2e/fixtures', { data: { reportIds: fixture.reportIds } })
      expect(cleanup.ok()).toBeTruthy()
    }
  })

  test('query 与 title 条件返回正文命中并规范化筛选', async ({ page, request, reportId, scenario }) => {
    const fixture = await seedQueryFixture(request, scenario, reportId)
    try {
      await openSessionWithScript(page, reportId, scriptedInstruction('按标题和正文查询历史周报', {
        steps: [
          {
            kind: 'stream',
            toolCalls: [{
              name: 'query_report_list',
              arguments: {
                query: scenario,
                title: scenario,
                startDate: '2026-12-01',
                endDate: '2027-01-31',
                statuses: ['current'],
                includeLegacy: false,
                relation: 'overlap',
                limit: 20,
              },
            }],
          },
          { kind: 'stream', text: '已按条件定位历史周报。' },
        ],
      }))

      await expect(page.getByText('已按条件定位历史周报。')).toBeVisible({ timeout: 30_000 })
      const detail = await latestSessionDetail(request, reportId)
      const output = detail.messages.find((part) => part.partType === 'tool-result' && part.data?.toolName === 'query_report_list')?.data?.output
      expect(output?.ok).toBe(true)
      expect(output?.appliedFilters).toEqual({
        query: scenario,
        title: scenario,
        startDate: '2026-12-01',
        endDate: '2027-01-31',
        statuses: ['current'],
        includeLegacy: false,
        relation: 'overlap',
        relativeToReportId: null,
        cursor: null,
        limit: 20,
      })
      expect(output?.items).toHaveLength(2)
      expect(output?.items.every((item) => Array.isArray(item.matches) && item.matches.length > 0)).toBe(true)
      expect(output?.items.map((item) => item.reportId)).toEqual(expect.arrayContaining([
        fixture.adjacentReportId,
        fixture.sameAudienceReportId,
      ]))
    } finally {
      const cleanup = await request.delete('/api/e2e/fixtures', { data: { reportIds: fixture.reportIds } })
      expect(cleanup.ok()).toBeTruthy()
    }
  })

  test('audience 参数被拒绝且不会改变服务端固定受众', async ({ page, request, reportId, scenario }) => {
    const fixture = await seedQueryFixture(request, scenario, reportId)
    try {
      await openSessionWithScript(page, reportId, scriptedInstruction('尝试切换历史查询受众', {
        steps: [
          {
            kind: 'stream',
            toolCalls: [{ name: 'query_report_list', arguments: { audience: 'leadership' } }],
          },
          { kind: 'stream', text: '受众仍由服务端固定，未执行跨受众查询。' },
        ],
      }))

      await expect(page.getByText('受众仍由服务端固定，未执行跨受众查询。')).toBeVisible({ timeout: 30_000 })
      const detail = await latestSessionDetail(request, reportId)
      const result = detail.messages.find((part) => part.partType === 'tool-result' && part.data?.toolName === 'query_report_list')
      expect(result?.data?.output).toMatchObject({
        ok: false,
        error: { code: 'INVALID_QUERY' },
      })
      expect(JSON.stringify(result?.data?.output)).not.toContain('leadership only')
    } finally {
      const cleanup = await request.delete('/api/e2e/fixtures', { data: { reportIds: fixture.reportIds } })
      expect(cleanup.ok()).toBeTruthy()
    }
  })
})
