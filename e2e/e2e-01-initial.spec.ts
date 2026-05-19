import { expect, test } from '@playwright/test';
import { deleteAllProjects, gotoProjectList } from './helpers.js';

/**
 * E2E-01 初回利用フロー: 起動 → プロジェクト新規 → タスク追加 → ガント表示。
 */
test.describe('E2E-01 初回利用', () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test('プロジェクト作成 → タスク 1 件追加 → ガントに表示', async ({ page }) => {
    await gotoProjectList(page);

    // 空状態のはず
    await expect(page.getByText('プロジェクトがまだありません')).toBeVisible();

    // 新規作成
    await page.getByRole('button', { name: /新規作成/ }).click();
    await page.getByLabel('プロジェクト名').fill('案件 A');
    await page.getByLabel('説明').fill('テスト用案件');
    await page.getByRole('button', { name: /^保存/ }).click();

    // 一覧に戻り、開く
    await expect(page.getByRole('option', { name: /案件 A/ })).toBeVisible();
    await page.getByRole('option', { name: /案件 A/ }).click();
    await page.getByRole('button', { name: /開く/ }).click();
    await page.waitForURL(/\/projects\/\d+/);

    // タスクが 0 件
    await expect(page.getByText('タスクがまだありません')).toBeVisible();

    // タスク追加
    await page.getByRole('button', { name: /タスク追加/ }).click();
    await page.getByLabel('タスク名').fill('要件定義');
    // 「開始日」 / 「期限」 のラベルには必須マーク * が含まれるため部分一致で取る
    await page.getByLabel(/^開始日/).fill('2026-06-01');
    await page.getByLabel(/^期限/).fill('2026-06-10');
    await page.getByRole('button', { name: /^保存/ }).click();

    // タスクツリーに表示される
    await expect(page.getByRole('treeitem', { name: /要件定義/ })).toBeVisible();
    // ガントに SVG が描画される
    await expect(page.locator('svg')).toBeVisible();
  });
});
