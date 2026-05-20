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

  test('VR-004 親候補から子孫を除外（UI 上で循環操作不可）', async ({ page, request }) => {
    // 子孫を追加: 親タスク → 子A → 孫
    await createTask(request, projectId, {
      name: '孫',
      start_date: '2026-06-15',
      due_date: '2026-06-20',
      parent_task_id: 2, // 子A の下
    });

    await gotoProjectList(page);
    await openProjectByName(page, 'CRUD案件');

    // 親タスクを編集
    await page.getByRole('treeitem', { name: /親タスク/ }).click();
    await page.getByRole('button', { name: '編集', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // VR-004 UI 抑止: 親タスクの「親タスク」select は自分自身および子孫（子A・孫）を除外
    // 候補は「（最上位）」のみで、子孫タスクは表示されない
    const parentSelect = dialog.locator('select').first();
    const optionTexts = await parentSelect.locator('option').allTextContents();
    expect(optionTexts).toEqual(['（最上位）']);

    // 「候補がありません」のヒント表示
    await expect(dialog.getByText('候補がありません')).toBeVisible();
  });
});
