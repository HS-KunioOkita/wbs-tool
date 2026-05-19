import type { Database as Db } from 'better-sqlite3';

/**
 * ENT-002 タスクの DAO。業務ルールは持たず CRUD のみ担う（COMP-007）。
 */
export interface TaskRow {
  task_id: number;
  project_id: number;
  parent_task_id: number | null;
  name: string;
  assignee: string;
  start_date: string;
  due_date: string;
  progress: number;
  description: string;
}

export interface TaskInsertInput {
  projectId: number;
  parentTaskId: number | null;
  name: string;
  assignee: string;
  startDate: string;
  dueDate: string;
  progress: number;
  description: string;
}

export interface TaskUpdateInput {
  parentTaskId: number | null;
  name: string;
  assignee: string;
  startDate: string;
  dueDate: string;
  progress: number;
  description: string;
}

export class TaskDao {
  constructor(private readonly db: Db) {}

  findAllByProject(projectId: number): TaskRow[] {
    return this.db
      .prepare(
        `SELECT task_id, project_id, parent_task_id, name, assignee,
                start_date, due_date, progress, description
           FROM tasks WHERE project_id = ? ORDER BY task_id ASC`,
      )
      .all(projectId) as TaskRow[];
  }

  findById(taskId: number): TaskRow | null {
    const row = this.db
      .prepare(
        `SELECT task_id, project_id, parent_task_id, name, assignee,
                start_date, due_date, progress, description
           FROM tasks WHERE task_id = ?`,
      )
      .get(taskId) as TaskRow | undefined;
    return row ?? null;
  }

  insert(input: TaskInsertInput): number {
    const result = this.db
      .prepare(
        `INSERT INTO tasks(project_id, parent_task_id, name, assignee,
                           start_date, due_date, progress, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.projectId,
        input.parentTaskId,
        input.name,
        input.assignee,
        input.startDate,
        input.dueDate,
        input.progress,
        input.description,
      );
    return Number(result.lastInsertRowid);
  }

  update(taskId: number, input: TaskUpdateInput): boolean {
    const result = this.db
      .prepare(
        `UPDATE tasks SET parent_task_id = ?, name = ?, assignee = ?,
                          start_date = ?, due_date = ?, progress = ?, description = ?
         WHERE task_id = ?`,
      )
      .run(
        input.parentTaskId,
        input.name,
        input.assignee,
        input.startDate,
        input.dueDate,
        input.progress,
        input.description,
        taskId,
      );
    return result.changes > 0;
  }

  /**
   * RULE-013: 子を昇格させた後にタスクを削除する。
   * 物理 FK は `ON DELETE SET NULL` で対応するが、ここで明示的に NULL を立てて
   * 順序由来の挙動差を排除する。依存関係は ON DELETE CASCADE で連動削除。
   */
  promoteChildrenAndDelete(taskId: number): {
    deleted: boolean;
    promotedChildIds: number[];
    deletedDependencyIds: number[];
  } {
    const promoted = this.db
      .prepare('SELECT task_id FROM tasks WHERE parent_task_id = ?')
      .all(taskId) as Array<{ task_id: number }>;

    const promotedChildIds = promoted.map((r) => r.task_id);

    if (promotedChildIds.length > 0) {
      this.db
        .prepare('UPDATE tasks SET parent_task_id = NULL WHERE parent_task_id = ?')
        .run(taskId);
    }

    const involvedDeps = this.db
      .prepare(
        'SELECT dependency_id FROM dependencies WHERE predecessor_task_id = ? OR successor_task_id = ?',
      )
      .all(taskId, taskId) as Array<{ dependency_id: number }>;
    const deletedDependencyIds = involvedDeps.map((r) => r.dependency_id);

    const result = this.db.prepare('DELETE FROM tasks WHERE task_id = ?').run(taskId);
    return {
      deleted: result.changes > 0,
      promotedChildIds,
      deletedDependencyIds,
    };
  }
}
