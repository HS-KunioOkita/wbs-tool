import type { Database as Db } from 'better-sqlite3';

export interface DependencyRow {
  dependency_id: number;
  predecessor_task_id: number;
  successor_task_id: number;
}

/**
 * ENT-003 依存関係 DAO。
 * UK 違反は SQLite の制約に委ね、上位（CLS-004）で事前検証する設計。
 */
export class DependencyDao {
  constructor(private readonly db: Db) {}

  findAllByProject(projectId: number): DependencyRow[] {
    return this.db
      .prepare(
        `SELECT d.dependency_id, d.predecessor_task_id, d.successor_task_id
           FROM dependencies d
           INNER JOIN tasks t1 ON t1.task_id = d.predecessor_task_id
          WHERE t1.project_id = ?
          ORDER BY d.dependency_id ASC`,
      )
      .all(projectId) as DependencyRow[];
  }

  findById(dependencyId: number): DependencyRow | null {
    const row = this.db
      .prepare(
        'SELECT dependency_id, predecessor_task_id, successor_task_id FROM dependencies WHERE dependency_id = ?',
      )
      .get(dependencyId) as DependencyRow | undefined;
    return row ?? null;
  }

  insert(input: { predecessorTaskId: number; successorTaskId: number }): number {
    const result = this.db
      .prepare('INSERT INTO dependencies(predecessor_task_id, successor_task_id) VALUES (?, ?)')
      .run(input.predecessorTaskId, input.successorTaskId);
    return Number(result.lastInsertRowid);
  }

  deleteById(dependencyId: number): boolean {
    const result = this.db
      .prepare('DELETE FROM dependencies WHERE dependency_id = ?')
      .run(dependencyId);
    return result.changes > 0;
  }
}
