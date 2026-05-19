/**
 * インタフェース設計書 §2.2 / §3.2 で定義された API-001〜013 の DTO 型。
 * 命名規則は OPEN-08 で snake_case を採用（設計書のフィールド名と一致させる）。
 */

// ---------- Project ----------

export interface ProjectDto {
  project_id: number;
  name: string;
  description: string;
  created_at: string; // ISO 8601 datetime
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name: string;
  description?: string;
}

export interface DeleteProjectResponse {
  deleted_project_id: number;
  deleted_task_count: number;
  deleted_dependency_count: number;
}

// ---------- Task ----------

export interface TaskDto {
  task_id: number;
  project_id: number;
  parent_task_id: number | null;
  name: string;
  assignee: string;
  start_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  progress: number; // 0〜100
  description: string;
}

export interface CreateTaskRequest {
  name: string;
  assignee?: string;
  start_date: string;
  due_date: string;
  progress?: number;
  parent_task_id?: number | null;
  description?: string;
}

export interface UpdateTaskRequest {
  name: string;
  assignee?: string;
  start_date: string;
  due_date: string;
  progress?: number;
  parent_task_id?: number | null;
  description?: string;
}

export interface UpdateTaskScheduleRequest {
  start_date: string;
  due_date: string;
}

export interface RecalculatedAncestor {
  task_id: number;
  start_date: string;
  due_date: string;
  progress: number;
}

export interface CreateTaskResponse {
  created_task: TaskDto;
  recalculated_ancestors: RecalculatedAncestor[];
}

export interface UpdateTaskResponse {
  updated_task: TaskDto;
  recalculated_ancestors: RecalculatedAncestor[];
}

export interface DeleteTaskResponse {
  deleted_task_id: number;
  promoted_child_task_ids: number[];
  deleted_dependency_ids: number[];
  recalculated_ancestors: RecalculatedAncestor[];
}

// ---------- Dependency ----------

export interface DependencyDto {
  dependency_id: number;
  predecessor_task_id: number;
  successor_task_id: number;
}

export interface CreateDependencyRequest {
  predecessor_task_id: number;
  successor_task_id: number;
}

export interface DeleteDependencyResponse {
  deleted_dependency_id: number;
}
