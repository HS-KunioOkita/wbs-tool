import { expect, test } from '@playwright/test';
import {
  API,
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

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // 初期: 先行関係なし
    await expect(dialog.getByText('先行関係はありません')).toBeVisible();

    // 依存関係編集ダイアログ内の 2 つ目の select が「相手タスク選択」
    await dialog.locator('select').nth(1).selectOption({ label: 'T2' });
    await dialog.getByRole('button', { name: '追加', exact: true }).click();

    // ダイアログ内の先行関係リストに T2 が表示される（状態変化で確認）
    const dependencyList = dialog.locator('ul');
    await expect(dependencyList.getByText('T2')).toBeVisible();
    await expect(page.getByText('依存関係を追加しました')).toBeVisible();

    // 削除ボタンを取得（T2 を含む行内の削除ボタン）
    const deleteButton = dialog
      .locator('li')
      .filter({ hasText: 'T2' })
      .getByRole('button', { name: '削除', exact: true });
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();

    // 削除完了: 先行関係が空に戻る（状態変化で確認）
    await expect(dialog.getByText('先行関係はありません')).toBeVisible();
  });

  test('VR-007 循環依存を拒否', async ({ page, request }) => {
    // 既に T1 → T2 → T3 を作成し、T3 → T1 で循環を試みる
    await request.post(`${API}/api/projects/${projectId}/dependencies`, {
      data: { predecessor_task_id: 1, successor_task_id: 2 },
    });
    await request.post(`${API}/api/projects/${projectId}/dependencies`, {
      data: { predecessor_task_id: 2, successor_task_id: 3 },
    });

    await gotoProjectList(page);
    await openProjectByName(page, '依存案件');
    await page.getByRole('treeitem', { name: /T3/ }).click();
    await page.getByRole('button', { name: /^依存関係/ }).click();

    const dialog = page.getByRole('dialog');
    // T3 → T1 で循環
    await dialog.locator('select').nth(1).selectOption({ label: 'T1' });
    await dialog.getByRole('button', { name: '追加', exact: true }).click();

    // ERR-002 → 422
    await expect(page.getByText(/cycle|循環/i)).toBeVisible();
  });
});
