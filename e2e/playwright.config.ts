import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// L4a：确定性浏览器 e2e。真实 dsh web host + fixture ~/.pictor，无模型调用。
// webServer 由 e2e/servers.mjs 承担：建 fixture、起 dsh、等就绪、随 Playwright 终止。
export default defineConfig({
  testDir: path.join(__dirname, 'specs'),
  timeout: 90_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:43123',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node ${path.join(__dirname, 'servers.mjs')}`,
    port: 43123,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', testIgnore: /live\.spec\.ts$/, use: { browserName: 'chromium' } },
    { name: 'live', testMatch: /live\.spec\.ts$/, use: { browserName: 'chromium' } },
  ],
})