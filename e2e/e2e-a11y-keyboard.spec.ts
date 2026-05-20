import { expect, test } from '@playwright/test';
import { createProject, createTask, deleteAllProjects, gotoProjectList } from './helpers.js';

/**
 * Phase 8.3 (T-083) アクセシビリティ最低基準: キーボードのみで主要 CRUD を完結できること。
 * - ボタン: Tab で到達、Enter / Space で押下
 * - リスト/ツリー: Tab で到達、Enter / Space で選択
 * - ダイアログ: Tab で項目間移動、Enter で保存
 * - フォーカスリング: :focus-visible で表示（base.css）
 */
test.describe('A11Y キーボード操作のみで主要 CRUD', () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test('キーボードのみでプロジェクト作成 → タスク追加 → 開く', async ({ page }) => {
    await gotoProjectList(page);

    // 「＋ 新規作成」ボタンへ到達して押下
    await page.getByRole('button', { name: /新規作成/ }).focus();
    await page.keyboard.press('Enter');

    // 新規ダイアログがフォーカスを受け取り、最初の入力にフォーカス
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Tab で「プロジェクト名」入力に到達して入力
    await dialog.getByLabel('プロジェクト名').focus();
    await page.keyboard.type('A11Y案件');

    // Tab で説明入力 → 保存ボタンへ移動
    await page.keyboard.press('Tab');
    await page.keyboard.type('キーボードのみで作成');
    // 保存ボタンへ Tab で到達して押下
    await dialog.getByRole('button', { name: /^保存/ }).focus();
    await page.keyboard.press('Enter');

    // 一覧に戻り、option へキーボードで選択
    const option = page.getByRole('option', { name: /A11Y案件/ });
    await expect(option).toBeVisible();
    await option.focus();
    await page.keyboard.press('Enter');
    // 選択された状態
    await expect(option).toHaveAttribute('aria-selected', 'true');

    // 「開く →」をキーボードで押下
    await page.getByRole('button', { name: /開く/ }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/projects\/\d+/);

    // タスク追加もキーボードで実施
    await page.getByRole('button', { name: /タスク追加/ }).focus();
    await page.keyboard.press('Enter');
    const taskDialog = page.getByRole('dialog');
    await expect(taskDialog).toBeVisible();

    await taskDialog.getByLabel('タスク名').focus();
    await page.keyboard.type('要件定義');
    // Tab で 担当者 → 開始日 へ
    await taskDialog.getByLabel(/^開始日/).fill('2026-06-01');
    await taskDialog.getByLabel(/^期限/).fill('2026-06-10');
    await taskDialog.getByRole('button', { name: /^保存/ }).focus();
    await page.keyboard.press('Enter');

    // ツリーに表示
    await expect(page.getByRole('treeitem', { name: /要件定義/ })).toBeVisible();
  });

  test('ツリー項目は Enter / Space で選択できる', async ({ page, request }) => {
    const pid = await createProject(request, 'キー選択案件');
    await createTask(request, pid, {
      name: 'T1',
      start_date: '2026-06-01',
      due_date: '2026-06-05',
    });

    await gotoProjectList(page);
    const option = page.getByRole('option', { name: /キー選択案件/ });
    await option.focus();
    await page.keyboard.press(' ');
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: /開く/ }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/projects\/\d+/);

    const treeitem = page.getByRole('treeitem', { name: /T1/ });
    await treeitem.focus();
    await page.keyboard.press('Enter');
    await expect(treeitem).toHaveAttribute('aria-selected', 'true');
  });
});
