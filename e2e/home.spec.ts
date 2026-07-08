import { test, expect } from '@playwright/test'

test.describe('首页', () => {
  test('应该正常加载', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/.*/)
    await expect(page.locator('h1, h2, h3').first()).toBeVisible()
  })

  test('应该显示来源筛选面板', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('来源筛选')).toBeVisible()
    await expect(page.getByText('手动录入')).toBeVisible()
    await expect(page.getByText('自动采集')).toBeVisible()
  })
})
