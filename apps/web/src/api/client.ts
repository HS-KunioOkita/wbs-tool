import type {
  ApiErrorResponse,
  CreateDependencyRequest,
  CreateProjectRequest,
  CreateTaskRequest,
  CreateTaskResponse,
  DeleteDependencyResponse,
  DeleteProjectResponse,
  DeleteTaskResponse,
  DependencyDto,
  ProjectDto,
  TaskDto,
  UpdateProjectRequest,
  UpdateTaskRequest,
  UpdateTaskResponse,
  UpdateTaskScheduleRequest,
} from '@wbs-tool/shared';
import { ApiError } from './api-error.js';

/**
 * Fastify サーバの REST API を呼ぶフロントエンドクライアント。
 * - 失敗時は ApiError を投げる（ERR-NNN を保持）
 * - 相関 ID をレスポンスから読み取り、エラー時にも保持する
 */
const BASE = '/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);

  if (!res.ok) {
    let payload: ApiErrorResponse;
    try {
      payload = (await res.json()) as ApiErrorResponse;
    } catch {
      payload = {
        error: { code: 'ERR-006', message: `HTTP ${res.status}` },
        correlationId: res.headers.get('x-correlation-id') ?? 'unknown',
      };
    }
    throw new ApiError(payload, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ============================================================
// Projects
// ============================================================

export const projectsApi = {
  list: () => request<{ projects: ProjectDto[] }>('GET', '/projects'),
  get: (projectId: number) => request<ProjectDto>('GET', `/projects/${projectId}`),
  create: (body: CreateProjectRequest) => request<ProjectDto>('POST', '/projects', body),
  update: (projectId: number, body: UpdateProjectRequest) =>
    request<ProjectDto>('PUT', `/projects/${projectId}`, body),
  remove: (projectId: number) => request<DeleteProjectResponse>('DELETE', `/projects/${projectId}`),
};

// ============================================================
// Tasks
// ============================================================

export const tasksApi = {
  listByProject: (projectId: number) =>
    request<{ tasks: TaskDto[] }>('GET', `/projects/${projectId}/tasks`),
  create: (projectId: number, body: CreateTaskRequest) =>
    request<CreateTaskResponse>('POST', `/projects/${projectId}/tasks`, body),
  update: (taskId: number, body: UpdateTaskRequest) =>
    request<UpdateTaskResponse>('PUT', `/tasks/${taskId}`, body),
  updateSchedule: (taskId: number, body: UpdateTaskScheduleRequest) =>
    request<UpdateTaskResponse>('PUT', `/tasks/${taskId}/schedule`, body),
  remove: (taskId: number) => request<DeleteTaskResponse>('DELETE', `/tasks/${taskId}`),
};

// ============================================================
// Dependencies
// ============================================================

export const dependenciesApi = {
  listByProject: (projectId: number) =>
    request<{ dependencies: DependencyDto[] }>('GET', `/projects/${projectId}/dependencies`),
  create: (projectId: number, body: CreateDependencyRequest) =>
    request<DependencyDto>('POST', `/projects/${projectId}/dependencies`, body),
  remove: (dependencyId: number) =>
    request<DeleteDependencyResponse>('DELETE', `/dependencies/${dependencyId}`),
};
