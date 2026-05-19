import { expect, test } from '@playwright/test';
import {
  createProject,
  createTask,
  deleteAllProjects,
  gotoProjectList,
  openProjectByName,
} from './helpers.js';

test.describe('E2E-02 タスク CRUD + 親子', () => {
  let projectId: number;

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    projectId = await createProject(request, 'CRUD案件');
    await createTask(request, projectId, {
      name: '親タスク',
      start_date: '2026-06-01',
      due_date: '2026-06-01',
    });
    await createTask(request, projectId, {
      name: '子A',
      start_date: '2026-06-05',
      due_date: '2026-06-10',
      progress: 50,
      parent_task_id: 1,
    });
  });

  test('親派生値が子から自動算出される (RULE-009/10)', async ({ page }) => {
    await gotoProjectList(page);
    await openProjectByName(page, 'CRUD案件');

    // ツリーに親タスクと子タスクの両方が表示される
    await expect(page.getByRole('treeitem', { name: /親タスク/ })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: /子A/ })).toBeVisible();

    // 親タスク行の進捗表示が子から算出された値（child A 50%、期間 6 日のみ → 50%）
    const parentRow = page.getByRole('treeitem', { name: /親タスク/ });
    await expect(parentRow).toContainText('50%');
  });

  test('VR-004 循環参照を試みると拒否される (422)', async ({ page, request }) => {
    // 親変更で循環を試みる: 子タスク C を作って、親を変更して循環させる
    const tId = await createTask(request, projectId, {
      name: '孫',
      start_date: '2026-06-15',
      due_date: '2026-06-20',
      parent_task_id: 2, // 子A の下
    });

    await gotoProjectList(page);
    await openProjectByName(page, 'CRUD案件');

    // 親タスクを選んで編集、親を「孫」に設定する → 循環
    await page.getByRole('treeitem', { name: /親タスク/ }).click();
    await page.getByRole('button', { name: '編集', exact: true }).click();
    const dialog = page.getByRole('dialog');
    // ダイアログ内の親タスク select box で「孫」を選ぶ
    await dialog.locator('select').first().selectOption(String(tId));
    await dialog.getByRole('button', { name: /^保存/ }).click();

    // VR-004 → ERR-002 → 422 がトーストで表示される
    await expect(page.getByText(/cycle|循環/i)).toBeVisible();
  });
});
