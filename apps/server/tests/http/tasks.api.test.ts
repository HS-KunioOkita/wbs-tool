import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestContext, type TestContext } from './test-server.js';

async function createProject(ctx: TestContext, name = 'P'): Promise<number> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/api/projects',
    payload: { name },
  });
  return res.json().project_id;
}

async function createTask(
  ctx: TestContext,
  projectId: number,
  payload: Record<string, unknown>,
): Promise<{ statusCode: number; body: any }> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: `/api/projects/${projectId}/tasks`,
    payload,
  });
  return { statusCode: res.statusCode, body: res.json() };
}

describe('API-006〜010 tasks', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await buildTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  describe('POST /api/projects/:id/tasks (API-007)', () => {
    it('creates a top-level task', async () => {
      const projectId = await createProject(ctx);
      const { statusCode, body } = await createTask(ctx, projectId, {
        name: 't1',
        start_date: '2026-01-01',
        due_date: '2026-01-10',
      });
      expect(statusCode).toBe(201);
      expect(body.created_task.task_id).toBe(1);
      expect(body.created_task.parent_task_id).toBeNull();
      expect(body.recalculated_ancestors).toEqual([]);
    });

    it('VR-001 rejects empty name → 400 ERR-001', async () => {
      const projectId = await createProject(ctx);
      const { statusCode, body } = await createTask(ctx, projectId, {
        name: '   ',
        start_date: '2026-01-01',
        due_date: '2026-01-10',
      });
      expect(statusCode).toBe(400);
      expect(body.error.code).toBe('ERR-001');
    });

    it('VR-002 rejects start > due → 400 ERR-001', async () => {
      const projectId = await createProject(ctx);
      const { statusCode, body } = await createTask(ctx, projectId, {
        name: 't1',
        start_date: '2026-01-20',
        due_date: '2026-01-10',
      });
      expect(statusCode).toBe(400);
      expect(body.error.code).toBe('ERR-001');
    });

    it('VR-003 rejects out-of-range progress', async () => {
      const projectId = await createProject(ctx);
      const { statusCode } = await createTask(ctx, projectId, {
        name: 't1',
        start_date: '2026-01-01',
        due_date: '2026-01-10',
        progress: 150,
      });
      expect(statusCode).toBe(400);
    });

    it('RULE-009/10 recalculates parent on child add', async () => {
      const projectId = await createProject(ctx);
      await createTask(ctx, projectId, {
        name: 'parent',
        start_date: '2026-01-15',
        due_date: '2026-01-15',
      });
      const { body } = await createTask(ctx, projectId, {
        name: 'child',
        start_date: '2026-01-05',
        due_date: '2026-01-20',
        progress: 50,
        parent_task_id: 1,
      });
      expect(body.recalculated_ancestors).toHaveLength(1);
      expect(body.recalculated_ancestors[0].task_id).toBe(1);
      expect(body.recalculated_ancestors[0].start_date).toBe('2026-01-05');
      expect(body.recalculated_ancestors[0].due_date).toBe('2026-01-20');
      expect(body.recalculated_ancestors[0].progress).toBe(50);
    });

    it('returns 404 when project not found', async () => {
      const { statusCode } = await createTask(ctx, 999, {
        name: 't',
        start_date: '2026-01-01',
        due_date: '2026-01-10',
      });
      expect(statusCode).toBe(404);
    });
  });

  describe('GET /api/projects/:id/tasks (API-006)', () => {
    it('returns flat list', async () => {
      const projectId = await createProject(ctx);
      await createTask(ctx, projectId, {
        name: 't1',
        start_date: '2026-01-01',
        due_date: '2026-01-10',
      });
      await createTask(ctx, projectId, {
        name: 't2',
        start_date: '2026-01-11',
        due_date: '2026-01-20',
      });
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/tasks`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().tasks).toHaveLength(2);
    });

    it('404 when project missing', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/projects/999/tasks',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/tasks/:id (API-008)', () => {
    it('VR-010 rejects schedule change on a parent task (422)', async () => {
      const projectId = await createProject(ctx);
      await createTask(ctx, projectId, {
        name: 'parent',
        start_date: '2026-01-01',
        due_date: '2026-01-01',
      });
      await createTask(ctx, projectId, {
        name: 'child',
        start_date: '2026-01-05',
        due_date: '2026-01-10',
        parent_task_id: 1,
      });

      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/tasks/1',
        payload: {
          name: 'parent',
          start_date: '2026-02-01',
          due_date: '2026-02-28',
        },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('ERR-002');
    });

    it('VR-004 rejects parent change that creates a cycle (422)', async () => {
      const projectId = await createProject(ctx);
      await createTask(ctx, projectId, {
        name: 't1',
        start_date: '2026-01-01',
        due_date: '2026-01-10',
      });
      await createTask(ctx, projectId, {
        name: 't2',
        start_date: '2026-01-11',
        due_date: '2026-01-20',
        parent_task_id: 1,
      });
      // Try to make t1 a child of t2 → cycle
      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/tasks/1',
        payload: {
          name: 't1-renamed',
          start_date: '2026-01-01',
          due_date: '2026-01-10',
          parent_task_id: 2,
        },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 404 when task missing', async () => {
      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/tasks/999',
        payload: { name: 't', start_date: '2026-01-01', due_date: '2026-01-10' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/tasks/:id/schedule (API-009)', () => {
    it('updates only schedule (drag-and-drop) and recalculates parent', async () => {
      const projectId = await createProject(ctx);
      await createTask(ctx, projectId, {
        name: 'parent',
        start_date: '2026-01-01',
        due_date: '2026-01-01',
      });
      await createTask(ctx, projectId, {
        name: 'child',
        start_date: '2026-01-05',
        due_date: '2026-01-10',
        progress: 60,
        parent_task_id: 1,
      });
      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/tasks/2/schedule',
        payload: { start_date: '2026-01-08', due_date: '2026-01-15' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.updated_task.start_date).toBe('2026-01-08');
      expect(body.updated_task.due_date).toBe('2026-01-15');
      // 親派生値も更新されること
      expect(body.recalculated_ancestors[0].start_date).toBe('2026-01-08');
      expect(body.recalculated_ancestors[0].due_date).toBe('2026-01-15');
    });

    it('VR-002 rejects start > due (400)', async () => {
      const projectId = await createProject(ctx);
      await createTask(ctx, projectId, {
        name: 't',
        start_date: '2026-01-01',
        due_date: '2026-01-10',
      });
      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/tasks/1/schedule',
        payload: { start_date: '2026-01-20', due_date: '2026-01-10' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('VR-010 rejects drag on a parent task (422)', async () => {
      const projectId = await createProject(ctx);
      await createTask(ctx, projectId, {
        name: 'parent',
        start_date: '2026-01-01',
        due_date: '2026-01-01',
      });
      await createTask(ctx, projectId, {
        name: 'child',
        start_date: '2026-01-05',
        due_date: '2026-01-10',
        parent_task_id: 1,
      });
      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/tasks/1/schedule',
        payload: { start_date: '2026-02-01', due_date: '2026-02-10' },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('DELETE /api/tasks/:id (API-010)', () => {
    it('RULE-013 promotes children and cascades dependencies', async () => {
      const projectId = await createProject(ctx);
      await createTask(ctx, projectId, {
        name: 'parent',
        start_date: '2026-01-01',
        due_date: '2026-01-01',
      });
      await createTask(ctx, projectId, {
        name: 'child1',
        start_date: '2026-01-05',
        due_date: '2026-01-10',
        parent_task_id: 1,
      });
      await createTask(ctx, projectId, {
        name: 'child2',
        start_date: '2026-01-11',
        due_date: '2026-01-20',
        parent_task_id: 1,
      });
      await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 2, successor_task_id: 3 },
      });

      const res = await ctx.app.inject({ method: 'DELETE', url: '/api/tasks/1' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.deleted_task_id).toBe(1);
      expect(body.promoted_child_task_ids.sort()).toEqual([2, 3]);
      expect(body.deleted_dependency_ids).toEqual([]);

      // remaining list should have 2 tasks at top level
      const list = await ctx.app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/tasks`,
      });
      const remaining = list.json().tasks;
      expect(remaining).toHaveLength(2);
      expect(
        remaining.every((t: { parent_task_id: number | null }) => t.parent_task_id === null),
      ).toBe(true);
    });

    it('returns 404 when task missing', async () => {
      const res = await ctx.app.inject({ method: 'DELETE', url: '/api/tasks/999' });
      expect(res.statusCode).toBe(404);
    });
  });
});
