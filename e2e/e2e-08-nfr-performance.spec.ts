import { expect, test } from '@playwright/test';
import { createDependency, createProject, deleteAllProjects } from './helpers.js';

const API = 'http://127.0.0.1:5174';

/**
 * E2E-08 NFR-001 性能実測（500 タスク × 1,000 依存関係）。
 *
 * - 初期描画: WBS メイン画面の遷移完了 → タスクツリーが描画完了まで 2 秒以内
 * - 操作後: 表示粒度切替（日 → 月）後の再描画 1 秒以内
 *
 * 注: ローカル DB に大量データを投入するため、CI では nightly で運用推奨（PLAN-RISK-04）。
 */
const TASK_COUNT = 500;
const DEPENDENCY_COUNT = 1000;

test.describe('E2E-08 NFR-001 性能実測', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000);
    await deleteAllProjects(request);
  });

  test('500 タスク × 1,000 依存関係で初期 2 秒 / 操作後 1 秒', async ({ request, page }) => {
    test.setTimeout(180_000);

    // ---- シード作成（API 経由） ----
    const projectId = await createProject(request, '性能案件');

    // タスク 500 件を bulk 作成
    const taskIds: number[] = [];
    for (let i = 0; i < TASK_COUNT; i++) {
      const startDay = (i % 30) + 1;
      const startDayStr = String(startDay).padStart(2, '0');
      const dueDay = String(Math.min(startDay + 3, 31)).padStart(2, '0');
      const res = await request.post(`${API}/api/projects/${projectId}/tasks`, {
        data: {
          name: `T${i + 1}`,
          assignee: `担当${(i % 10) + 1}`,
          start_date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${startDayStr}`,
          due_date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${dueDay}`,
        },
      });
      const body = (await res.json()) as { created_task: { task_id: number } };
      taskIds.push(body.created_task.task_id);
    }

    // 依存関係 1000 件を bulk 追加（線形チェーン + 追加分は ランダムな先行ペア。循環は避ける）
    for (let i = 0; i < DEPENDENCY_COUNT; i++) {
      const pred = (i % (TASK_COUNT - 1)) + 1;
      const succ = pred + 1 + (i % 2); // pred+1 or pred+2
      if (succ > TASK_COUNT) continue;
      try {
        await createDependency(request, projectId, taskIds[pred - 1]!, taskIds[succ - 1]!);
      } catch {
        // 重複・循環は無視
      }
    }

    // ---- 初期描画時間 ----
    await page.goto('/');
    await page.getByRole('option', { name: /性能案件/ }).click();

    const t0 = Date.now();
    await page.getByRole('button', { name: /開く/ }).click();
    await page.waitForURL(/\/projects\/\d+/);
    // ツリーが 1 行以上描画されるまで待つ
    await page.getByRole('treeitem').first().waitFor({ state: 'visible' });
    const initialMs = Date.now() - t0;

    // ---- 操作後（粒度切替）の再描画時間 ----
    const t1 = Date.now();
    await page.getByRole('button', { name: '月', exact: true }).click();
    // 月ラベルが描画されるまで待つ
    await page.locator('svg text').first().waitFor({ state: 'visible' });
    const switchMs = Date.now() - t1;

    // ---- レポート ----
    // eslint-disable-next-line no-console
    console.log(`[NFR-001 actual] initial=${initialMs}ms, granularity_switch=${switchMs}ms`);

    // 目標: 初期 2 秒以内、操作後 1 秒以内（NFR-001）
    expect(initialMs, `initial ${initialMs}ms exceeds NFR-001 (<= 2000ms)`).toBeLessThanOrEqual(
      2000,
    );
    expect(
      switchMs,
      `granularity switch ${switchMs}ms exceeds NFR-001 (<= 1000ms)`,
    ).toBeLessThanOrEqual(1000);
  });
});
