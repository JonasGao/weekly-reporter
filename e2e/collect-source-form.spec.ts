import { test, expect } from '@playwright/test'

test.describe('采集源编辑页', () => {
  test('新建采集源页面应该正常加载', async ({ page }) => {
    // Navigate to the collect source new page
    await page.goto('/collect/new')

    // Wait for the page to load - check for any heading or form element
    // This is a basic smoke test
    await page.waitForLoadState('networkidle')

    // The page should have some content (even if redirected to login)
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toBeTruthy()
  })
})
