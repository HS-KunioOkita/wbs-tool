import type { Database as Db } from 'better-sqlite3';
import { Dependency } from '../domain/dependency.js';
import { ProjectWbs } from '../domain/project-wbs.js';
import { Task } from '../domain/task.js';
import { TaskPeriod } from '../domain/task-period.js';
import { TaskProgress } from '../domain/task-progress.js';
import { NotFoundError } from '../errors/app-errors.js';
import { DependencyDao } from './dao/dependency-dao.js';
import { ProjectDao } from './dao/project-dao.js';
import { TaskDao } from './dao/task-dao.js';
import { runInTransaction } from './transaction.js';

/**
 * 集約ルート CLS-004 を SQLite から組み立て、操作後の状態を永続化する。
 *
 * 設計判断: フェーズ 1 の素朴な実装として「ロード時に全タスク・全依存をメモリに展開し、
 * セーブ時はトランザクション内で全置換」を採用する。500 タスク × 1,000 依存関係（NFR-002）
 * 規模では問題ない（fullySaveSnapshot は数 ms オーダー）。将来差分セーブに切り替える場合は
 * 同じインタフェースの実装を差し替えれば良い。
 */
export class ProjectWbsRepository {
  private readonly projectDao: ProjectDao;
  private readonly taskDao: TaskDao;
  private readonly dependencyDao: DependencyDao;

  constructor(private readonly db: Db) {
    this.projectDao = new ProjectDao(db);
    this.taskDao = new TaskDao(db);
    this.dependencyDao = new DependencyDao(db);
  }

  /**
   * 指定プロジェクトの集約ルートをロードする。
   */
  load(projectId: number): ProjectWbs {
    const project = this.projectDao.findById(projectId);
    if (!project) {
      throw new NotFoundError(`project ${projectId} not found`);
    }
    const taskRows = this.taskDao.findAllByProject(projectId);
    const dependencyRows = this.dependencyDao.findAllByProject(projectId);

    const tasks = taskRows.map(
      (r) =>
        new Task({
          taskId: r.task_id,
          name: r.name,
          assignee: r.assignee,
          period: TaskPeriod.of(r.start_date, r.due_date),
          progress: TaskProgress.of(r.progress),
          parentTaskId: r.parent_task_id,
          description: r.description,
        }),
    );
    const dependencies = dependencyRows.map((r) =>
      Dependency.of({
        dependencyId: r.dependency_id,
        predecessorTaskId: r.predecessor_task_id,
        successorTaskId: r.successor_task_id,
      }),
    );

    return new ProjectWbs({
      projectId: project.project_id,
      projectName: project.name,
      description: project.description,
      createdAt: project.created_at,
      tasks,
      dependencies,
    });
  }

  /**
   * 集約ルートの内容で SQLite を全置換する（同期トランザクション内）。
   */
  save(wbs: ProjectWbs): void {
    runInTransaction(this.db, () => {
      // タスク・依存関係を一度削除して再挿入する単純な方針。
      // FK ON DELETE CASCADE で dependencies は tasks 削除に追従するが、
      // 明示順序で順番を制御する（自動採番との競合を避ける）。
      this.db
        .prepare(
          'DELETE FROM dependencies WHERE predecessor_task_id IN (SELECT task_id FROM tasks WHERE project_id = ?)',
        )
        .run(wbs.projectId);
      this.db.prepare('DELETE FROM tasks WHERE project_id = ?').run(wbs.projectId);

      this.projectDao.update(wbs.projectId, { name: wbs.name, description: wbs.description });

      // タスクは parent_task_id が NULL のものから挿入し、依存順を維持する
      const insertTaskStmt = this.db.prepare(
        `INSERT INTO tasks(task_id, project_id, parent_task_id, name, assignee,
                           start_date, due_date, progress, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertDepStmt = this.db.prepare(
        'INSERT INTO dependencies(dependency_id, predecessor_task_id, successor_task_id) VALUES (?, ?, ?)',
      );

      const remaining = new Map(wbs.tasks().map((t) => [t.taskId, t]));
      const inserted = new Set<number>();
      // 親 → 子の順に挿入することで FK 違反を避ける
      while (remaining.size > 0) {
        let progress = false;
        for (const [id, t] of remaining) {
          if (t.parentTaskId === null || inserted.has(t.parentTaskId)) {
            insertTaskStmt.run(
              t.taskId,
              wbs.projectId,
              t.parentTaskId,
              t.name,
              t.assignee,
              t.period.startDate,
              t.period.dueDate,
              t.progress.value,
              t.description,
            );
            inserted.add(id);
            remaining.delete(id);
            progress = true;
          }
        }
        if (!progress) {
          throw new Error(
            'inconsistent tasks: parent reference forms a cycle (should be prevented by domain layer)',
          );
        }
      }

      for (const d of wbs.dependencies()) {
        insertDepStmt.run(d.dependencyId, d.predecessorTaskId, d.successorTaskId);
      }
    });
  }

  /**
   * 新規プロジェクト作成（タスク・依存関係なし）。
   */
  createProject(input: { name: string; description: string }): number {
    const createdAt = new Date().toISOString();
    return this.projectDao.insert({ ...input, createdAt });
  }

  /**
   * 次の task_id をグローバルに採番する。
   * tasks.task_id は全プロジェクト共通のサロゲートキー（データ設計 ENT-002）のため、
   * 集約単位ではなく DB の MAX(task_id)+1 を返す。
   */
  nextTaskId(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(task_id), 0) AS n FROM tasks').get() as {
      n: number;
    };
    return row.n + 1;
  }

  nextDependencyId(): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(dependency_id), 0) AS n FROM dependencies')
      .get() as { n: number };
    return row.n + 1;
  }
}
