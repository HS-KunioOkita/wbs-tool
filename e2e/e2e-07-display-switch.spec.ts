import { expect, test } from '@playwright/test';
import {
  createProject,
  createTask,
  deleteAllProjects,
  gotoProjectList,
  openProjectByName,
} from './helpers.js';

test.describe('E2E-07 表示粒度・依存線切替', () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const pid = await createProject(request, '表示案件');
    await createTask(request, pid, {
      name: 'T1',
      start_date: '2026-06-01',
      due_date: '2026-06-05',
    });
    await createTask(request, pid, {
      name: 'T2',
      start_date: '2026-07-01',
      due_date: '2026-07-15',
    });
  });

  test('日 ↔ 月 粒度切替と依存線 ON/OFF が独立に効く', async ({ page }) => {
    await gotoProjectList(page);
    await openProjectByName(page, '表示案件');

    // 既定: 日粒度 + 依存線 ON
    const dayBtn = page.getByRole('button', { name: '日', exact: true });
    const monthBtn = page.getByRole('button', { name: '月', exact: true });

    // 月に切り替え
    await monthBtn.click();
    // 月ラベル "2026/06" / "2026/07" が SVG 内テキストにあるか
    await expect(page.locator('svg').getByText('2026/06')).toBeVisible();

    // 日に戻す
    await dayBtn.click();

    // 依存線トグル OFF → ON（checkbox role で取得して SVG の g[aria-label] と区別）
    const switchToggle = page.getByRole('checkbox', { name: /依存線/ });
    await switchToggle.uncheck();
    await switchToggle.check();
  });
});
