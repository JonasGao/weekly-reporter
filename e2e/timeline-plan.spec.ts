import { test, expect } from './app-fixture'
import { disposeTimelineReport, seedTimelineReport } from './timeline-fixtures'

test.describe('时间线计划表', () => {
  test('在两个受众标签页展示精确上一周期 current 终版，并显示重复章节告警', async ({ page, request }) => {
    const reportIds = await seedTimelineReport(request, `timeline-${Date.now()}`)
    try {
      await page.goto('/')
      const panel = page.getByRole('region', { name: 'Timeline plans' })
      await expect(panel).toBeVisible()
      await expect(panel.getByRole('tab', { name: 'Leadership' })).toBeVisible()
      await expect(panel.getByText(/leadership plan/)).toBeVisible()
      await expect(panel.getByRole('alert')).toContainText('only the first was used')
      await panel.getByRole('tab', { name: 'Personal' }).click()
      await expect(panel.getByText(/personal plan/)).toBeVisible()
      await expect(panel.getByText(/Source: personal · current/)).toBeVisible()
      await expect(panel.getByText(/stale excluded|legacy excluded/i)).toHaveCount(0)
    } finally {
      await disposeTimelineReport(request, reportIds)
    }
  })

  test('显示没有精确来源的明确空状态', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('region', { name: 'Timeline plans' }).getByRole('status')).toContainText('No exact previous-cycle current final report')
  })
})
