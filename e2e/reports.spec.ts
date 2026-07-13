import { test, expect } from '@playwright/test'

test.describe('周报列表页', () => {
  const createdReportIds: number[] = []

  test.beforeEach(async ({ request }) => {
    // Seed two reports with different week ranges via the API
    const reports = [
      {
        title: 'E2E 测试周报 1',
        content: '内容 1',
        weekStart: '2024-01-08',
        weekEnd: '2024-01-14',
      },
      {
        title: 'E2E 测试周报 2',
        content: '内容 2',
        weekStart: '2024-01-15',
        weekEnd: '2024-01-21',
      },
    ]

    for (const report of reports) {
      const response = await request.post('/api/reports', {
        data: report,
      })
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      createdReportIds.push(data.id)
    }
  })

  test.afterEach(async ({ request }) => {
    for (const id of createdReportIds) {
      await request.delete(`/api/reports/${id}`)
    }
    createdReportIds.length = 0
  })

  test('每个卡片都应显示日期范围', async ({ page }) => {
    await page.goto('/reports')

    // Wait for the list to render
    await expect(page.getByText('E2E 测试周报 1')).toBeVisible()
    await expect(page.getByText('E2E 测试周报 2')).toBeVisible()

    // Verify each card displays its week range
    await expect(page.getByText('01/08 - 01/14')).toBeVisible()
    await expect(page.getByText('01/15 - 01/21')).toBeVisible()
  })
})
