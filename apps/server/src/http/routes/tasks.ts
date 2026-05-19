import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import {
  createTaskSchema,
  updateTaskScheduleSchema,
  updateTaskSchema,
  type CreateTaskResponse,
  type DeleteTaskResponse,
  type TaskDto,
  type UpdateTaskResponse,
} from '@wbs-tool/shared';
import { ProjectDao } from '../../db/dao/project-dao.js';
import { TaskDao } from '../../db/dao/task-dao.js';
import { ProjectWbsRepository } from '../../db/project-wbs-repository.js';
import { runInTransaction } from '../../db/transaction.js';
import { TaskPeriod } from '../../domain/task-period.js';
import { TaskProgress } from '../../domain/task-progress.js';
import { NotFoundError } from '../../errors/app-errors.js';
import { parseOrThrow } from './zod-utils.js';
import { toRecalculatedAncestors, toTaskDto } from './dto-mapper.js';

/**
 * API-006〜010 タスク関連エンドポイント。
 */
export function registerTaskRoutes(app: FastifyInstance, db: Database): void {
  const projectDao = new ProjectDao(db);
  const taskDao = new TaskDao(db);
  const repository = new ProjectWbsRepository(db);

  // API-006 GET /api/projects/:projectId/tasks
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/tasks',
    async (req): Promise<{ tasks: TaskDto[] }> => {
      const projectId = Number.parseInt(req.params.projectId, 10);
      if (!projectDao.findById(projectId)) {
        throw new NotFoundError(`project ${projectId} not found`);
      }
      const rows = taskDao.findAllByProject(projectId);
      return {
        tasks: rows.map((r) => ({
          task_id: r.task_id,
          project_id: r.project_id,
          parent_task_id: r.parent_task_id,
          name: r.name,
          assignee: r.assignee,
          start_date: r.start_date,
          due_date: r.due_date,
          progress: r.progress,
          description: r.description,
        })),
      };
    },
  );

  // API-007 POST /api/projects/:projectId/tasks
  app.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/tasks',
    async (req, reply): Promise<CreateTaskResponse> => {
      const projectId = Number.parseInt(req.params.projectId, 10);
      const input = parseOrThrow(createTaskSchema, req.body);

      const result = runInTransaction(db, () => {
        const wbs = repository.load(projectId); // 404 if missing
        const newId = repository.nextTaskId();
        const { recalculatedAncestors } = wbs.addTask({
          taskId: newId,
          name: input.name,
          assignee: input.assignee ?? '',
          period: TaskPeriod.of(input.start_date, input.due_date),
          progress: TaskProgress.of(input.progress ?? 0),
          parentTaskId: input.parent_task_id ?? null,
          description: input.description ?? '',
        });
        repository.save(wbs);
        const createdTask = wbs.tasks().find((t) => t.taskId === newId)!;
        return {
          created_task: toTaskDto(createdTask, projectId),
          recalculated_ancestors: toRecalculatedAncestors(recalculatedAncestors),
        };
      });
      void reply.code(201);
      return result;
    },
  );

  // API-008 PUT /api/tasks/:taskId
  app.put<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId',
    async (req): Promise<UpdateTaskResponse> => {
      const taskId = Number.parseInt(req.params.taskId, 10);
      const input = parseOrThrow(updateTaskSchema, req.body);

      const existing = taskDao.findById(taskId);
      if (!existing) throw new NotFoundError(`task ${taskId} not found`);
      const projectId = existing.project_id;

      const result = runInTransaction(db, () => {
        const wbs = repository.load(projectId);
        const { recalculatedAncestors } = wbs.updateTask(taskId, {
          name: input.name,
          assignee: input.assignee ?? '',
          period: TaskPeriod.of(input.start_date, input.due_date),
          progress: TaskProgress.of(input.progress ?? 0),
          parentTaskId: input.parent_task_id ?? null,
          description: input.description ?? '',
        });
        repository.save(wbs);
        const updated = wbs.tasks().find((t) => t.taskId === taskId)!;
        return {
          updated_task: toTaskDto(updated, projectId),
          recalculated_ancestors: toRecalculatedAncestors(recalculatedAncestors),
        };
      });
      return result;
    },
  );

  // API-009 PUT /api/tasks/:taskId/schedule
  app.put<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId/schedule',
    async (req): Promise<UpdateTaskResponse> => {
      const taskId = Number.parseInt(req.params.taskId, 10);
      const input = parseOrThrow(updateTaskScheduleSchema, req.body);

      const existing = taskDao.findById(taskId);
      if (!existing) throw new NotFoundError(`task ${taskId} not found`);
      const projectId = existing.project_id;

      const result = runInTransaction(db, () => {
        const wbs = repository.load(projectId);
        const { recalculatedAncestors } = wbs.updateTask(taskId, {
          period: TaskPeriod.of(input.start_date, input.due_date),
        });
        repository.save(wbs);
        const updated = wbs.tasks().find((t) => t.taskId === taskId)!;
        return {
          updated_task: toTaskDto(updated, projectId),
          recalculated_ancestors: toRecalculatedAncestors(recalculatedAncestors),
        };
      });
      return result;
    },
  );

  // API-010 DELETE /api/tasks/:taskId
  app.delete<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId',
    async (req): Promise<DeleteTaskResponse> => {
      const taskId = Number.parseInt(req.params.taskId, 10);
      const existing = taskDao.findById(taskId);
      if (!existing) throw new NotFoundError(`task ${taskId} not found`);
      const projectId = existing.project_id;

      const result = runInTransaction(db, () => {
        const wbs = repository.load(projectId);
        const deleteResult = wbs.deleteTask(taskId);
        repository.save(wbs);
        return {
          deleted_task_id: taskId,
          promoted_child_task_ids: deleteResult.promotedChildTaskIds,
          deleted_dependency_ids: deleteResult.deletedDependencyIds,
          recalculated_ancestors: toRecalculatedAncestors(deleteResult.recalculatedAncestors),
        };
      });
      return result;
    },
  );
}
