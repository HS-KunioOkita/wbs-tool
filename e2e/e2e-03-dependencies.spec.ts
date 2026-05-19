import { expect, test } from '@playwright/test';
import {
  createProject,
  createTask,
  deleteAllProjects,
  gotoProjectList,
  openProjectByName,
} from './helpers.js';

test.describe('E2E-03 依存関係 CRUD + 循環防止', () => {
  let projectId: number;

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    projectId = await createProject(request, '依存案件');
    await createTask(request, projectId, {
      name: 'T1',
      start_date: '2026-06-01',
      due_date: '2026-06-05',
    });
    await createTask(request, projectId, {
      name: 'T2',
      start_date: '2026-06-06',
      due_date: '2026-06-10',
    });
    await createTask(request, projectId, {
      name: 'T3',
      start_date: '2026-06-11',
      due_date: '2026-06-15',
    });
  });

  test('依存関係を UI から追加・削除できる', async ({ page }) => {
    await gotoProjectList(page);
    await openProjectByName(page, '依存案件');

    await page.getByRole('treeitem', { name: /T1/ }).click();
    await page.getByRole('button', { name: /^依存関係/ }).click();

    // 依存関係編集ダイアログ内の 2 つ目の select が「相手タスク選択」
    const dialog = page.getByRole('dialog');
    await dialog.locator('select').nth(1).selectOption({ label: 'T2' });
    await dialog.getByRole('button', { name: /^追加/ }).click();

    // 成功トースト
    await expect(page.getByText(/依存関係を追加しました/)).toBeVisible();

    // ダイアログ内の削除ボタン（1 件目）
    await dialog.getByRole('button', { name: /^削除/ }).first().click();
    await expect(page.getByText(/依存関係を削除しました/)).toBeVisible();
  });

  test('VR-007 循環依存を拒否', async ({ page, request }) => {
    // 既に T1 → T2 → T3 を作成し、T3 → T1 で循環を試みる
    await request.post('http://127.0.0.1:5174/api/projects/' + projectId + '/dependencies', {
      data: { predecessor_task_id: 1, successor_task_id: 2 },
    });
    await request.post('http://127.0.0.1:5174/api/projects/' + projectId + '/dependencies', {
      data: { predecessor_task_id: 2, successor_task_id: 3 },
    });

    await gotoProjectList(page);
    await openProjectByName(page, '依存案件');
    await page.getByRole('treeitem', { name: /T3/ }).click();
    await page.getByRole('button', { name: /^依存関係/ }).click();

    const dialog = page.getByRole('dialog');
    // T3 → T1 で循環
    await dialog.locator('select').nth(1).selectOption({ label: 'T1' });
    await dialog.getByRole('button', { name: /^追加/ }).click();

    // ERR-002 → 422
    await expect(page.getByText(/cycle|循環/i)).toBeVisible();
  });
});
