import type { FastifyInstance } from 'fastify';
import {
  createProjectSchema,
  updateProjectSchema,
  type DeleteProjectResponse,
  type ProjectDto,
} from '@wbs-tool/shared';
import { ProjectDao } from '../../db/dao/project-dao.js';
import { ProjectWbsRepository } from '../../db/project-wbs-repository.js';
import { runInTransaction } from '../../db/transaction.js';
import { NotFoundError } from '../../errors/app-errors.js';
import type { Database } from 'better-sqlite3';
import { parseOrThrow } from './zod-utils.js';
import { toProjectDto } from './dto-mapper.js';

/**
 * API-001〜005 プロジェクト関連エンドポイント。
 */
export function registerProjectRoutes(app: FastifyInstance, db: Database): void {
  const projectDao = new ProjectDao(db);
  const repository = new ProjectWbsRepository(db);

  // API-001 GET /api/projects
  app.get('/api/projects', async (): Promise<{ projects: ProjectDto[] }> => {
    const rows = projectDao.findAll();
    return {
      projects: rows.map((r) => ({
        project_id: r.project_id,
        name: r.name,
        description: r.description,
        created_at: r.created_at,
      })),
    };
  });

  // API-005 GET /api/projects/:projectId
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId',
    async (req): Promise<ProjectDto> => {
      const id = Number.parseInt(req.params.projectId, 10);
      const row = projectDao.findById(id);
      if (!row) throw new NotFoundError(`project ${id} not found`);
      return {
        project_id: row.project_id,
        name: row.name,
        description: row.description,
        created_at: row.created_at,
      };
    },
  );

  // API-002 POST /api/projects
  app.post('/api/projects', async (req, reply): Promise<ProjectDto> => {
    const input = parseOrThrow(createProjectSchema, req.body);
    const description = input.description ?? '';
    const createdAt = new Date().toISOString();
    const id = projectDao.insert({
      name: input.name,
      description,
      createdAt,
    });
    void reply.code(201);
    return {
      project_id: id,
      name: input.name,
      description,
      created_at: createdAt,
    };
  });

  // API-003 PUT /api/projects/:projectId
  app.put<{ Params: { projectId: string } }>(
    '/api/projects/:projectId',
    async (req): Promise<ProjectDto> => {
      const id = Number.parseInt(req.params.projectId, 10);
      const input = parseOrThrow(updateProjectSchema, req.body);

      const wbs = repository.load(id); // VR-009 はドメインの rename 内、404 は load 内で判定
      wbs.rename(input.name);
      wbs.updateDescription(input.description ?? '');
      runInTransaction(db, () => {
        projectDao.update(id, { name: wbs.name, description: wbs.description });
      });
      return toProjectDto(wbs);
    },
  );

  // API-004 DELETE /api/projects/:projectId
  app.delete<{ Params: { projectId: string } }>(
    '/api/projects/:projectId',
    async (req): Promise<DeleteProjectResponse> => {
      const id = Number.parseInt(req.params.projectId, 10);
      const result = runInTransaction(db, () => projectDao.deleteCascade(id));
      if (!result.deletedProject) {
        throw new NotFoundError(`project ${id} not found`);
      }
      return {
        deleted_project_id: id,
        deleted_task_count: result.deletedTaskCount,
        deleted_dependency_count: result.deletedDependencyCount,
      };
    },
  );
}
