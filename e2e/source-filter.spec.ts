import { test, expect } from '@playwright/test'

test.describe('采集源过滤记忆功能', () => {
  test('刷新页面后应该保留筛选状态', async ({ page }) => {
    await page.goto('/')

    // 点击"手动录入"复选框
    const manualCheckbox = page.getByRole('checkbox').first()
    await manualCheckbox.click()

    // 验证复选框已选中
    await expect(manualCheckbox).toBeChecked()

    // 刷新页面
    await page.reload()

    // 验证筛选状态被保留
    await expect(manualCheckbox).toBeChecked()
  })

  test('应该能够从 sessionStorage 恢复筛选状态', async ({ page }) => {
    await page.goto('/')

    // 先设置一个筛选状态
    const checkboxes = page.getByRole('checkbox')
    const manualCheckbox = checkboxes.first()
    await manualCheckbox.click()

    // 验证 sessionStorage 中已保存
    const savedSources = await page.evaluate(() => {
      return sessionStorage.getItem('selectedSources')
    })
    expect(savedSources).toBe('["manual"]')

    // 刷新页面
    await page.reload()

    // 验证状态被恢复
    await expect(manualCheckbox).toBeChecked()
  })
})
