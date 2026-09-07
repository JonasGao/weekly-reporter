import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import os from 'os'
import { randomUUID } from 'node:crypto'
import { nextWebServerCommand } from './e2e/next-server'

const e2eRunId = randomUUID()

/**
 * Playwright 配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: nextWebServerCommand(3100),
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      // 使用临时目录隔离测试数据，避免污染生产数据库
      XDG_DATA_HOME: path.join(os.tmpdir(), `weekly-reporter-e2e-data-${e2eRunId}`),
      XDG_CONFIG_HOME: path.join(os.tmpdir(), `weekly-reporter-e2e-config-${e2eRunId}`),
      E2E_FIXTURES: '1',
    },
  },
})
