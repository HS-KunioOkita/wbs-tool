import { z } from 'zod';
import {
  dateSchema,
  isPeriodOrdered,
  progressSchema,
  projectNameSchema,
  taskNameSchema,
  VR,
} from './validation-rules.js';

/**
 * API リクエストの zod スキーマ。
 * クライアントの即時検証とサーバの最終検証で共有する。
 * 詳細仕様: interface-design.md §3.2。
 */

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: z.string().optional().default(''),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: projectNameSchema,
  description: z.string().optional().default(''),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

const periodFields = {
  start_date: dateSchema,
  due_date: dateSchema,
} as const;

const periodOrdered = (data: { start_date: string; due_date: string }): boolean =>
  isPeriodOrdered(data.start_date, data.due_date);

export const createTaskSchema = z
  .object({
    name: taskNameSchema,
    assignee: z.string().default(''),
    ...periodFields,
    progress: progressSchema.default(0),
    parent_task_id: z.number().int().positive().nullable().default(null),
    description: z.string().default(''),
  })
  .refine(periodOrdered, { message: VR.TASK_PERIOD_ORDERED, path: ['due_date'] });
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    name: taskNameSchema,
    assignee: z.string().default(''),
    ...periodFields,
    progress: progressSchema.default(0),
    parent_task_id: z.number().int().positive().nullable().default(null),
    description: z.string().default(''),
  })
  .refine(periodOrdered, { message: VR.TASK_PERIOD_ORDERED, path: ['due_date'] });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const updateTaskScheduleSchema = z
  .object({
    ...periodFields,
  })
  .refine(periodOrdered, { message: VR.TASK_PERIOD_ORDERED, path: ['due_date'] });
export type UpdateTaskScheduleInput = z.infer<typeof updateTaskScheduleSchema>;

export const createDependencySchema = z
  .object({
    predecessor_task_id: z.number().int().positive(),
    successor_task_id: z.number().int().positive(),
  })
  .refine((d) => d.predecessor_task_id !== d.successor_task_id, {
    message: VR.DEP_NOT_SELF,
    path: ['successor_task_id'],
  });
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
