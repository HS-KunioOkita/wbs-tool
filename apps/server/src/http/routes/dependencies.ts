import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import {
  createDependencySchema,
  type DependencyDto,
  type DeleteDependencyResponse,
} from '@wbs-tool/shared';
import { DependencyDao } from '../../db/dao/dependency-dao.js';
import { ProjectDao } from '../../db/dao/project-dao.js';
import { TaskDao } from '../../db/dao/task-dao.js';
import { ProjectWbsRepository } from '../../db/project-wbs-repository.js';
import { runInTransaction } from '../../db/transaction.js';
import { BusinessRuleViolationError, NotFoundError } from '../../errors/app-errors.js';
import { VR } from '@wbs-tool/shared';
import { parseOrThrow } from './zod-utils.js';
import { toDependencyDto } from './dto-mapper.js';

/**
 * API-011〜013 依存関係エンドポイント。
 */
export function registerDependencyRoutes(app: FastifyInstance, db: Database): void {
  const projectDao = new ProjectDao(db);
  const taskDao = new TaskDao(db);
  const dependencyDao = new DependencyDao(db);
  const repository = new ProjectWbsRepository(db);

  // API-011 GET /api/projects/:projectId/dependencies
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/dependencies',
    async (req): Promise<{ dependencies: DependencyDto[] }> => {
      const projectId = Number.parseInt(req.params.projectId, 10);
      if (!projectDao.findById(projectId)) {
        throw new NotFoundError(`project ${projectId} not found`);
      }
      const rows = dependencyDao.findAllByProject(projectId);
      return {
        dependencies: rows.map((r) => ({
          dependency_id: r.dependency_id,
          predecessor_task_id: r.predecessor_task_id,
          successor_task_id: r.successor_task_id,
        })),
      };
    },
  );

  // API-012 POST /api/projects/:projectId/dependencies
  app.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/dependencies',
    async (req, reply): Promise<DependencyDto> => {
      const projectId = Number.parseInt(req.params.projectId, 10);
      const input = parseOrThrow(createDependencySchema, req.body);

      // VR-008 同一プロジェクト判定。両タスクが本プロジェクト配下であること。
      for (const id of [input.predecessor_task_id, input.successor_task_id]) {
        const t = taskDao.findById(id);
        if (!t) throw new NotFoundError(`task ${id} not found`);
        if (t.project_id !== projectId) {
          throw new BusinessRuleViolationError(
            `task ${id} does not belong to project ${projectId}`,
            { details: [VR.SAME_PROJECT] },
          );
        }
      }

      const result = runInTransaction(db, () => {
        const wbs = repository.load(projectId);
        const newId = repository.nextDependencyId();
        const created = wbs.addDependency({
          dependencyId: newId,
          predecessorTaskId: input.predecessor_task_id,
          successorTaskId: input.successor_task_id,
        });
        repository.save(wbs);
        return toDependencyDto(created);
      });
      void reply.code(201);
      return result;
    },
  );

  // API-013 DELETE /api/dependencies/:dependencyId
  app.delete<{ Params: { dependencyId: string } }>(
    '/api/dependencies/:dependencyId',
    async (req): Promise<DeleteDependencyResponse> => {
      const id = Number.parseInt(req.params.dependencyId, 10);
      const existing = dependencyDao.findById(id);
      if (!existing) throw new NotFoundError(`dependency ${id} not found`);
      const deleted = runInTransaction(db, () => dependencyDao.deleteById(id));
      if (!deleted) throw new NotFoundError(`dependency ${id} not found`);
      return { deleted_dependency_id: id };
    },
  );
}
