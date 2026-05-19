import { expect, test } from '@playwright/test';
import {
  createDependency,
  createProject,
  createTask,
  deleteAllProjects,
  gotoProjectList,
  openProjectByName,
} from './helpers.js';

test.describe('E2E-06 削除と連鎖', () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test('プロジェクト削除で配下タスク・依存も削除 (RULE-012)', async ({ page, request }) => {
    const pid = await createProject(request, '削除案件');
    const t1 = await createTask(request, pid, {
      name: 'T1',
      start_date: '2026-06-01',
      due_date: '2026-06-05',
    });
    const t2 = await createTask(request, pid, {
      name: 'T2',
      start_date: '2026-06-06',
      due_date: '2026-06-10',
    });
    await createDependency(request, pid, t1, t2);

    await gotoProjectList(page);
    await page.getByRole('option', { name: /削除案件/ }).click();

    // ツールバーの「削除」ボタン（ダイアログ内の「削除する」ではない方）
    await page.locator('main').getByRole('button', { name: '削除', exact: true }).click();

    // 削除確認ダイアログを開き、影響件数の表示を待つ
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/タスク/)).toBeVisible();
    await dialog.getByRole('button', { name: /削除する/ }).click();

    // プロジェクトが消える
    await expect(page.getByText(/削除しました/)).toBeVisible();
    await expect(page.getByText('プロジェクトがまだありません')).toBeVisible();
  });

  test('タスク削除で子は親 NULL に昇格、関与依存も削除 (RULE-013)', async ({ page, request }) => {
    const pid = await createProject(request, 'タスク削除案件');
    const parent = await createTask(request, pid, {
      name: '親',
      start_date: '2026-06-01',
      due_date: '2026-06-01',
    });
    const childA = await createTask(request, pid, {
      name: '子A',
      start_date: '2026-06-05',
      due_date: '2026-06-10',
      parent_task_id: parent,
    });
    const childB = await createTask(request, pid, {
      name: '子B',
      start_date: '2026-06-11',
      due_date: '2026-06-15',
      parent_task_id: parent,
    });
    await createDependency(request, pid, childA, childB);

    await gotoProjectList(page);
    await openProjectByName(page, 'タスク削除案件');

    // 親を選択 → 削除（window.confirm を auto-accept）
    await page.getByRole('treeitem', { name: /^親/ }).click();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: '削除', exact: true }).click();

    // 「昇格 2 件 / 依存削除 1 件」のトースト
    await expect(page.getByText(/昇格 2 件 \/ 依存削除 1 件/)).toBeVisible();
    // 子 A / 子 B は残るが親無しになる
    await expect(page.getByRole('treeitem', { name: /子A/ })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: /子B/ })).toBeVisible();
  });
});
