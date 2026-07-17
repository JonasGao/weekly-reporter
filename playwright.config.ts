import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import os from 'os'

/**
 * Playwright 配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.CI ? undefined : 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // 使用临时目录隔离测试数据，避免污染生产数据库
      XDG_DATA_HOME: path.join(os.tmpdir(), 'weekly-reporter-e2e-data'),
      XDG_CONFIG_HOME: path.join(os.tmpdir(), 'weekly-reporter-e2e-config'),
    },
  },
})
