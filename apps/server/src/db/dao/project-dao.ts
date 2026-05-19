import type { Database as Db } from 'better-sqlite3';

/**
 * ENT-001 プロジェクトの DAO。業務ルールは持たず、CRUD のみ担う（COMP-007）。
 */
export interface ProjectRow {
  project_id: number;
  name: string;
  description: string;
  created_at: string;
}

export class ProjectDao {
  constructor(private readonly db: Db) {}

  findAll(): ProjectRow[] {
    return this.db
      .prepare(
        'SELECT project_id, name, description, created_at FROM projects ORDER BY created_at ASC',
      )
      .all() as ProjectRow[];
  }

  findById(projectId: number): ProjectRow | null {
    const row = this.db
      .prepare(
        'SELECT project_id, name, description, created_at FROM projects WHERE project_id = ?',
      )
      .get(projectId) as ProjectRow | undefined;
    return row ?? null;
  }

  insert(input: { name: string; description: string; createdAt: string }): number {
    const result = this.db
      .prepare('INSERT INTO projects(name, description, created_at) VALUES (?, ?, ?)')
      .run(input.name, input.description, input.createdAt);
    return Number(result.lastInsertRowid);
  }

  update(projectId: number, input: { name: string; description: string }): boolean {
    const result = this.db
      .prepare('UPDATE projects SET name = ?, description = ? WHERE project_id = ?')
      .run(input.name, input.description, projectId);
    return result.changes > 0;
  }

  /**
   * 物理削除。FK ON DELETE CASCADE により tasks / dependencies は連動削除される（RULE-012）。
   * 削除前の影響件数を返す。
   */
  deleteCascade(projectId: number): {
    deletedProject: boolean;
    deletedTaskCount: number;
    deletedDependencyCount: number;
  } {
    const taskCount = (
      this.db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE project_id = ?').get(projectId) as {
        n: number;
      }
    ).n;
    const depCount = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS n FROM dependencies d
            WHERE d.predecessor_task_id IN (SELECT task_id FROM tasks WHERE project_id = ?)`,
        )
        .get(projectId) as { n: number }
    ).n;
    const result = this.db.prepare('DELETE FROM projects WHERE project_id = ?').run(projectId);
    return {
      deletedProject: result.changes > 0,
      deletedTaskCount: taskCount,
      deletedDependencyCount: depCount,
    };
  }
}
