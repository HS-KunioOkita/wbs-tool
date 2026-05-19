import type { DependencyDto, ProjectDto, RecalculatedAncestor, TaskDto } from '@wbs-tool/shared';
import type { Dependency } from '../../domain/dependency.js';
import type { ProjectWbs } from '../../domain/project-wbs.js';
import type { Task } from '../../domain/task.js';

/**
 * ドメインオブジェクト → API レスポンス DTO の変換。
 * snake_case と camelCase の境界をここで吸収する。
 */

export function toTaskDto(task: Task, projectId: number): TaskDto {
  return {
    task_id: task.taskId,
    project_id: projectId,
    parent_task_id: task.parentTaskId,
    name: task.name,
    assignee: task.assignee,
    start_date: task.period.startDate,
    due_date: task.period.dueDate,
    progress: task.progress.value,
    description: task.description,
  };
}

export function toDependencyDto(dep: Dependency): DependencyDto {
  return {
    dependency_id: dep.dependencyId,
    predecessor_task_id: dep.predecessorTaskId,
    successor_task_id: dep.successorTaskId,
  };
}

export function toProjectDto(wbs: ProjectWbs): ProjectDto {
  return {
    project_id: wbs.projectId,
    name: wbs.name,
    description: wbs.description,
    created_at: wbs.createdAt,
  };
}

export function toRecalculatedAncestors(tasks: Task[]): RecalculatedAncestor[] {
  return tasks.map((t) => ({
    task_id: t.taskId,
    start_date: t.period.startDate,
    due_date: t.period.dueDate,
    progress: t.progress.value,
  }));
}
