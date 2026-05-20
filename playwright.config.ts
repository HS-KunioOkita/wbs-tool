import { defineConfig, devices } from '@playwright/test';

/**
 * T-073 E2E 環境。
 * - 単独で server を起動（DB は OS の一時ディレクトリ）し、Vite dev でフロントを配信
 * - 固定システム日付は各テストで `page.clock` 等を使うか必要時に対応
 * - CI では nightly 実行を推奨（PLAN-RISK-04）
 *
 * ポートは開発用（API 5174 / web 5173）と衝突しない専用ポートを使う。
 * これにより `npm run dev` 稼働中に E2E を流しても、reuseExistingServer が
 * 本番 DB（./data/wbs.sqlite）に接続した dev サーバを誤って再利用しない。
 */
const E2E_API_PORT = 5274;
const E2E_WEB_PORT = 5273;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${E2E_WEB_PORT}`,
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
      // テスト専用 DB（OS 一時ディレクトリ）+ 専用ポート。本番 DB には一切触れない。
      command: `DB_PATH=$(mktemp -t wbs-e2e-XXXXXX).sqlite PORT=${E2E_API_PORT} FALLBACK_PORT=${E2E_API_PORT} npx tsx apps/server/src/index.ts`,
      port: E2E_API_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Vite の /api プロキシ先を E2E API ポートへ向ける（VITE_API_PORT）。
      command: `VITE_API_PORT=${E2E_API_PORT} npx --workspace apps/web vite --port ${E2E_WEB_PORT}`,
      port: E2E_WEB_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
