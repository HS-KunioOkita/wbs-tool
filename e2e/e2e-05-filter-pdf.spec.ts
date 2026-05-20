import { expect, test } from '@playwright/test';
import {
  createProject,
  createTask,
  deleteAllProjects,
  gotoProjectList,
  openProjectByName,
} from './helpers.js';

test.describe('E2E-05 フィルタ → PDF', () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const pid = await createProject(request, 'フィルタ案件');
    await createTask(request, pid, {
      name: 'T1',
      assignee: '山田',
      start_date: '2026-06-01',
      due_date: '2026-06-05',
    });
    await createTask(request, pid, {
      name: 'T2',
      assignee: '佐藤',
      start_date: '2026-06-10',
      due_date: '2026-06-15',
    });
    await createTask(request, pid, {
      name: 'T3',
      assignee: '山田',
      start_date: '2026-06-20',
      due_date: '2026-06-25',
    });
  });

  test('担当者フィルタ適用後に PDF を出力できる', async ({ page }) => {
    await gotoProjectList(page);
    await openProjectByName(page, 'フィルタ案件');

    // 初期 3 件
    await expect(page.getByText(/表示中 3 \/ 3 件/)).toBeVisible();

    // フィルタを開く
    await page.getByRole('button', { name: /^フィルタ/ }).click();
    const filterDialog = page.getByRole('dialog');
    await filterDialog.getByLabel(/担当者/).fill('山田');
    await filterDialog.getByRole('button', { name: /^適用/ }).click();

    // フィルタ反映後 2 件（山田担当の T1, T3）
    await expect(page.getByText(/表示中 2 \/ 3 件/)).toBeVisible();
    await expect(page.getByText(/フィルタ適用中/)).toBeVisible();

    // PDF ダイアログを開く
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    const pdfDialog = page.getByRole('dialog');
    await expect(pdfDialog.getByRole('heading', { name: 'PDF エクスポート' })).toBeVisible();

    // 対象タスク件数は 2 件（フィルタ後）
    await expect(pdfDialog.getByText(/対象タスク件数:/)).toContainText('2');

    // ダウンロード開始を待ち受け
    const downloadPromise = page.waitForEvent('download');
    await pdfDialog.getByRole('button', { name: '出力', exact: true }).click();
    const download = await downloadPromise;

    // ファイル名規則: ${projectName}_${kind}_${YYYYMMDD-HHMMSS}.pdf
    expect(download.suggestedFilename()).toMatch(
      /^フィルタ案件_(?:wbs|tasks|gantt)_\d{8}-\d{6}\.pdf$/,
    );
  });

  test('対象 0 件のとき PDF ボタンが押せず、PDF ダイアログも出ない (ERR-004 抑止)', async ({
    page,
  }) => {
    await gotoProjectList(page);
    await openProjectByName(page, 'フィルタ案件');

    // 該当無しのフィルタ（存在しない担当者）
    await page.getByRole('button', { name: /^フィルタ/ }).click();
    const filterDialog = page.getByRole('dialog');
    await filterDialog.getByLabel(/担当者/).fill('存在しない担当');
    await filterDialog.getByRole('button', { name: /^適用/ }).click();

    // フィルタ後 0 件
    await expect(page.getByText(/表示中 0 \/ 3 件/)).toBeVisible();

    // PDF ボタンが disabled
    const pdfButton = page.getByRole('button', { name: 'PDF', exact: true });
    await expect(pdfButton).toBeDisabled();
  });
});
