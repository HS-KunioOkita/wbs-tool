import { create } from 'zustand';
import type { DependencyDto, ProjectDto, TaskDto } from '@wbs-tool/shared';
import { dependenciesApi, projectsApi, tasksApi } from '../api/index.js';

/**
 * 「現在開いているプロジェクト」の正本サーバ側を、フロント側で表示用にミラーする。
 * 楽観的更新は採らない（アーキ設計 RISK-005）: API 応答を受けてから再ロードする。
 */
interface ProjectStore {
  currentProject: ProjectDto | null;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  isLoading: boolean;
  open: (projectId: number) => Promise<void>;
  reloadTasks: () => Promise<void>;
  reloadDependencies: () => Promise<void>;
  close: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentProject: null,
  tasks: [],
  dependencies: [],
  isLoading: false,

  open: async (projectId) => {
    set({ isLoading: true });
    try {
      const [project, tasksRes, depsRes] = await Promise.all([
        projectsApi.get(projectId),
        tasksApi.listByProject(projectId),
        dependenciesApi.listByProject(projectId),
      ]);
      set({
        currentProject: project,
        tasks: tasksRes.tasks,
        dependencies: depsRes.dependencies,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  reloadTasks: async () => {
    const current = get().currentProject;
    if (!current) return;
    const res = await tasksApi.listByProject(current.project_id);
    set({ tasks: res.tasks });
  },

  reloadDependencies: async () => {
    const current = get().currentProject;
    if (!current) return;
    const res = await dependenciesApi.listByProject(current.project_id);
    set({ dependencies: res.dependencies });
  },

  close: () => set({ currentProject: null, tasks: [], dependencies: [] }),
}));
