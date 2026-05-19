import type { Page, APIRequestContext } from '@playwright/test';

const API = 'http://127.0.0.1:5174';

/**
 * E2E ヘルパ。API を直接叩いてシード作成、UI 経由の操作はテスト本体で。
 */

export async function deleteAllProjects(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${API}/api/projects`);
  if (!res.ok()) return;
  const body = (await res.json()) as { projects: Array<{ project_id: number }> };
  for (const p of body.projects) {
    await request.delete(`${API}/api/projects/${p.project_id}`);
  }
}

export async function createProject(request: APIRequestContext, name: string): Promise<number> {
  const res = await request.post(`${API}/api/projects`, {
    data: { name },
  });
  const body = (await res.json()) as { project_id: number };
  return body.project_id;
}

export async function createTask(
  request: APIRequestContext,
  projectId: number,
  payload: {
    name: string;
    start_date: string;
    due_date: string;
    progress?: number;
    parent_task_id?: number | null;
    assignee?: string;
  },
): Promise<number> {
  const res = await request.post(`${API}/api/projects/${projectId}/tasks`, {
    data: payload,
  });
  const body = (await res.json()) as { created_task: { task_id: number } };
  return body.created_task.task_id;
}

export async function createDependency(
  request: APIRequestContext,
  projectId: number,
  predecessorTaskId: number,
  successorTaskId: number,
): Promise<number> {
  const res = await request.post(`${API}/api/projects/${projectId}/dependencies`, {
    data: { predecessor_task_id: predecessorTaskId, successor_task_id: successorTaskId },
  });
  const body = (await res.json()) as { dependency_id: number };
  return body.dependency_id;
}

export async function gotoProjectList(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

export async function openProjectByName(page: Page, name: string): Promise<void> {
  // Click the project row by name, then [開く →]
  await page
    .getByRole('option', { name: new RegExp(name) })
    .first()
    .click();
  await page.getByRole('button', { name: /^開く/ }).click();
  await page.waitForURL(/\/projects\/\d+/);
}
