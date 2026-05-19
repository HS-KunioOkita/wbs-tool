import { defineConfig, devices } from '@playwright/test';

/**
 * T-073 E2E 環境。
 * - 単独で server を起動（DB は OS の一時ディレクトリ）し、Vite dev でフロントを配信
 * - 固定システム日付は各テストで `page.clock` 等を使うか必要時に対応
 * - CI では nightly 実行を推奨（PLAN-RISK-04）
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        'DB_PATH=$(mktemp -t wbs-e2e-XXXXXX).sqlite PORT=5174 npx tsx apps/server/src/index.ts',
      port: 5174,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npx --workspace apps/web vite --port 5173',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
