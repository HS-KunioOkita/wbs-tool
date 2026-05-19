import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestContext, type TestContext } from './test-server.js';

async function setup(ctx: TestContext): Promise<{ projectId: number }> {
  const p = await ctx.app.inject({
    method: 'POST',
    url: '/api/projects',
    payload: { name: 'P' },
  });
  const projectId = p.json().project_id;
  await ctx.app.inject({
    method: 'POST',
    url: `/api/projects/${projectId}/tasks`,
    payload: { name: 't1', start_date: '2026-01-01', due_date: '2026-01-05' },
  });
  await ctx.app.inject({
    method: 'POST',
    url: `/api/projects/${projectId}/tasks`,
    payload: { name: 't2', start_date: '2026-01-06', due_date: '2026-01-10' },
  });
  await ctx.app.inject({
    method: 'POST',
    url: `/api/projects/${projectId}/tasks`,
    payload: { name: 't3', start_date: '2026-01-11', due_date: '2026-01-15' },
  });
  return { projectId };
}

describe('API-011〜013 dependencies', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await buildTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  describe('POST /api/projects/:id/dependencies (API-012)', () => {
    it('creates a dependency (201)', async () => {
      const { projectId } = await setup(ctx);
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: 2 },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.predecessor_task_id).toBe(1);
      expect(body.successor_task_id).toBe(2);
    });

    it('VR-005 rejects self-dependency (400)', async () => {
      const { projectId } = await setup(ctx);
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: 1 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('ERR-001');
    });

    it('VR-006 rejects duplicate pair (409)', async () => {
      const { projectId } = await setup(ctx);
      await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: 2 },
      });
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: 2 },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('ERR-002');
    });

    it('VR-007 rejects cycle (422)', async () => {
      const { projectId } = await setup(ctx);
      await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: 2 },
      });
      await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 2, successor_task_id: 3 },
      });
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 3, successor_task_id: 1 },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('ERR-002');
    });

    it('VR-008 rejects cross-project task (422)', async () => {
      const { projectId } = await setup(ctx);
      // Make another project with its own task
      const p2 = await ctx.app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'P2' },
      });
      const p2id = p2.json().project_id;
      const t = await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${p2id}/tasks`,
        payload: { name: 'x', start_date: '2026-01-01', due_date: '2026-01-10' },
      });
      const crossId = t.json().created_task.task_id;
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: crossId },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 404 when a referenced task is missing', async () => {
      const { projectId } = await setup(ctx);
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: 9999 },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/projects/:id/dependencies (API-011)', () => {
    it('returns the list', async () => {
      const { projectId } = await setup(ctx);
      await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: 2 },
      });
      await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 2, successor_task_id: 3 },
      });
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/dependencies`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().dependencies).toHaveLength(2);
    });

    it('404 when project missing', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/projects/999/dependencies',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/dependencies/:id (API-013)', () => {
    it('deletes by id', async () => {
      const { projectId } = await setup(ctx);
      const c = await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: 2 },
      });
      const depId = c.json().dependency_id;
      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/dependencies/${depId}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().deleted_dependency_id).toBe(depId);
    });

    it('404 when missing', async () => {
      const res = await ctx.app.inject({ method: 'DELETE', url: '/api/dependencies/999' });
      expect(res.statusCode).toBe(404);
    });
  });
});
