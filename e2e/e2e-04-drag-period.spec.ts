import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  API,
  createProject,
  createTask,
  deleteAllProjects,
  gotoProjectList,
  openProjectByName,
} from './helpers.js';

const PX_PER_DAY = 28; // day granularity (apps/web/src/features/wbs/gantt/coordinates.ts)

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function fetchTaskDates(
  request: APIRequestContext,
  projectId: number,
  taskId: number,
): Promise<{ start_date: string; due_date: string }> {
  const res = await request.get(`${API}/api/projects/${projectId}/tasks`);
  const body = (await res.json()) as {
    tasks: Array<{ task_id: number; start_date: string; due_date: string }>;
  };
  const found = body.tasks.find((t) => t.task_id === taskId);
  if (!found) throw new Error(`task ${taskId} not found`);
  return { start_date: found.start_date, due_date: found.due_date };
}

async function ganttBarBox(page: Page, taskName: string): Promise<BBox> {
  const g = page.locator(`g[aria-label^="${taskName} ("]`);
  await g.first().waitFor({ state: 'visible' });
  const rect = g.first().locator('rect').first();
  const bbox = await rect.boundingBox();
  if (!bbox) throw new Error(`bbox not found for ${taskName}`);
  return bbox;
}

async function dragMove(page: Page, taskName: string, deltaPxX: number): Promise<void> {
  const bbox = await ganttBarBox(page, taskName);
  const startX = bbox.x + bbox.width / 2;
  const startY = bbox.y + bbox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaPxX, startY, { steps: 5 });
  await page.mouse.up();
}

async function dragResizeRight(page: Page, taskName: string, deltaPxX: number): Promise<void> {
  const bbox = await ganttBarBox(page, taskName);
  const startX = bbox.x + bbox.width - 3;
  const startY = bbox.y + bbox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaPxX, startY, { steps: 5 });
  await page.mouse.up();
}

async function dragResizeLeft(page: Page, taskName: string, deltaPxX: number): Promise<void> {
  const bbox = await ganttBarBox(page, taskName);
  const startX = bbox.x + 3;
  const startY = bbox.y + bbox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaPxX, startY, { steps: 5 });
  await page.mouse.up();
}

test.describe('E2E-04 ドラッグで期間変更', () => {
  let projectId: number;
  let taskId: number;

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    projectId = await createProject(request, 'ドラッグ案件');
    taskId = await createTask(request, projectId, {
      name: 'T1',
      start_date: '2026-06-10',
      due_date: '2026-06-14',
    });
  });

  test('バー全体ドラッグで開始日・期限が同方向にシフト', async ({ page, request }) => {
    await gotoProjectList(page);
    await openProjectByName(page, 'ドラッグ案件');

    await dragMove(page, 'T1', 3 * PX_PER_DAY);

    await expect
      .poll(async () => (await fetchTaskDates(request, projectId, taskId)).start_date)
      .toBe('2026-06-13');
    const after = await fetchTaskDates(request, projectId, taskId);
    expect(after.due_date).toBe('2026-06-17');
  });

  test('右ハンドルドラッグで期限のみ延長', async ({ page, request }) => {
    await gotoProjectList(page);
    await openProjectByName(page, 'ドラッグ案件');

    await dragResizeRight(page, 'T1', 2 * PX_PER_DAY);

    await expect
      .poll(async () => (await fetchTaskDates(request, projectId, taskId)).due_date)
      .toBe('2026-06-16');
    const after = await fetchTaskDates(request, projectId, taskId);
    expect(after.start_date).toBe('2026-06-10');
  });

  test('左ハンドルドラッグで開始日のみ前倒し', async ({ page, request }) => {
    await gotoProjectList(page);
    await openProjectByName(page, 'ドラッグ案件');

    await dragResizeLeft(page, 'T1', -2 * PX_PER_DAY);

    await expect
      .poll(async () => (await fetchTaskDates(request, projectId, taskId)).start_date)
      .toBe('2026-06-08');
    const after = await fetchTaskDates(request, projectId, taskId);
    expect(after.due_date).toBe('2026-06-14');
  });

  test('親バーはドラッグ不可（API-009 が呼ばれない / 値が変わらない）', async ({
    page,
    request,
  }) => {
    const childId = await createTask(request, projectId, {
      name: '子A',
      start_date: '2026-06-20',
      due_date: '2026-06-25',
      parent_task_id: taskId,
    });

    await gotoProjectList(page);
    await openProjectByName(page, 'ドラッグ案件');

    // 親バーが見えているがハンドル無し（VR-010 UI 抑止）
    await page.locator(`g[aria-label^="T1 ("]`).first().waitFor({ state: 'visible' });

    // 親バーをドラッグ試行（ERR-004 トーストが出る想定）
    await dragMove(page, 'T1', 3 * PX_PER_DAY);

    // 親自身の値は子から派生（20〜25）のまま、子も保持
    const parent = await fetchTaskDates(request, projectId, taskId);
    expect(parent.start_date).toBe('2026-06-20');
    expect(parent.due_date).toBe('2026-06-25');

    const child = await fetchTaskDates(request, projectId, childId);
    expect(child.start_date).toBe('2026-06-20');
    expect(child.due_date).toBe('2026-06-25');
  });
});
