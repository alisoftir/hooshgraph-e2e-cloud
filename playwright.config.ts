import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.HG_BASE_URL || 'https://hooshgraph.com'

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // شبکه ایران گاهی timeout می‌دهد — retry برای کرون اتوماتیک
  retries: 2,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fa-IR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
