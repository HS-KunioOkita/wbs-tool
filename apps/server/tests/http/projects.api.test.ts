import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestContext, type TestContext } from './test-server.js';

describe('API-001〜005 projects', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await buildTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  describe('POST /api/projects (API-002)', () => {
    it('creates a project with 201', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'P1', description: 'd' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.project_id).toBe(1);
      expect(body.name).toBe('P1');
      expect(body.description).toBe('d');
      expect(body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('VR-009 rejects empty name → ERR-001 + 400', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: '   ', description: 'd' },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error.code).toBe('ERR-001');
      expect(body.correlationId).toBeDefined();
    });

    it('allows missing description', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'P1' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().description).toBe('');
    });
  });

  describe('GET /api/projects (API-001)', () => {
    it('returns list ordered by created_at', async () => {
      await ctx.app.inject({ method: 'POST', url: '/api/projects', payload: { name: 'A' } });
      await ctx.app.inject({ method: 'POST', url: '/api/projects', payload: { name: 'B' } });
      const res = await ctx.app.inject({ method: 'GET', url: '/api/projects' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.projects).toHaveLength(2);
      expect(body.projects.map((p: { name: string }) => p.name)).toEqual(['A', 'B']);
    });
  });

  describe('GET /api/projects/:id (API-005)', () => {
    it('returns 404 (ERR-003) when missing', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/projects/999' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('ERR-003');
    });
  });

  describe('PUT /api/projects/:id (API-003)', () => {
    it('updates name and description', async () => {
      await ctx.app.inject({ method: 'POST', url: '/api/projects', payload: { name: 'old' } });
      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/projects/1',
        payload: { name: 'new', description: 'd2' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('new');
      expect(res.json().description).toBe('d2');
    });

    it('returns 404 when project not found', async () => {
      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/projects/9',
        payload: { name: 'x' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id (API-004)', () => {
    it('cascades and reports counts', async () => {
      const c = await ctx.app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'P' },
      });
      const projectId = c.json().project_id;

      // create two tasks
      await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/tasks`,
        payload: { name: 't1', start_date: '2026-01-01', due_date: '2026-01-10' },
      });
      await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/tasks`,
        payload: { name: 't2', start_date: '2026-01-11', due_date: '2026-01-20' },
      });
      // add a dependency
      await ctx.app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/dependencies`,
        payload: { predecessor_task_id: 1, successor_task_id: 2 },
      });

      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.deleted_project_id).toBe(projectId);
      expect(body.deleted_task_count).toBe(2);
      expect(body.deleted_dependency_count).toBe(1);
    });

    it('returns 404 when not found', async () => {
      const res = await ctx.app.inject({ method: 'DELETE', url: '/api/projects/9' });
      expect(res.statusCode).toBe(404);
    });
  });
});
