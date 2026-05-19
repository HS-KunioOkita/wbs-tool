import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type SqliteDb } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations/runner.js';
import { ProjectWbsRepository } from '../../src/db/project-wbs-repository.js';
import { TaskPeriod } from '../../src/domain/task-period.js';
import { TaskProgress } from '../../src/domain/task-progress.js';
import { NotFoundError } from '../../src/errors/app-errors.js';

describe('SQLite migrations + ProjectWbsRepository', () => {
  let db: SqliteDb;
  let repo: ProjectWbsRepository;

  beforeEach(() => {
    db = openDatabase(':memory:', { runIntegrityCheck: false });
    runMigrations(db.raw);
    repo = new ProjectWbsRepository(db.raw);
  });

  afterEach(() => {
    db.close();
  });

  it('applies migrations and tracks schema_version', () => {
    const rows = db.raw
      .prepare('SELECT version FROM schema_version ORDER BY version ASC')
      .all() as Array<{ version: number }>;
    expect(rows.map((r) => r.version)).toEqual([1]);
  });

  it('idempotent on second run', () => {
    const second = runMigrations(db.raw);
    expect(second.appliedVersions).toEqual([]);
  });

  it('creates, loads, and round-trips a project', () => {
    const projectId = repo.createProject({ name: 'P1', description: 'd1' });
    const wbs = repo.load(projectId);

    wbs.addTask({
      taskId: 1,
      name: 't1',
      assignee: '',
      period: TaskPeriod.of('2026-01-01', '2026-01-10'),
      progress: TaskProgress.of(0),
      parentTaskId: null,
      description: '',
    });
    wbs.addTask({
      taskId: 2,
      name: 't2',
      assignee: '',
      period: TaskPeriod.of('2026-01-05', '2026-01-15'),
      progress: TaskProgress.of(50),
      parentTaskId: 1,
      description: '',
    });
    wbs.addDependency({ dependencyId: 1, predecessorTaskId: 1, successorTaskId: 2 });

    repo.save(wbs);

    const reloaded = repo.load(projectId);
    expect(reloaded.tasks()).toHaveLength(2);
    expect(reloaded.dependencies()).toHaveLength(1);
    // 親は子から再算出された値で永続化されていること（RULE-009/10）
    const parent = reloaded.tasks().find((t) => t.taskId === 1)!;
    expect(parent.period.startDate).toBe('2026-01-05');
    expect(parent.period.dueDate).toBe('2026-01-15');
    expect(parent.progress.value).toBe(50);
  });

  it('cascades on project delete (RULE-012) via raw cascading FK', () => {
    const projectId = repo.createProject({ name: 'P1', description: '' });
    const wbs = repo.load(projectId);
    wbs.addTask({
      taskId: 1,
      name: 't1',
      assignee: '',
      period: TaskPeriod.of('2026-01-01', '2026-01-10'),
      progress: TaskProgress.of(0),
      parentTaskId: null,
      description: '',
    });
    repo.save(wbs);

    db.raw.prepare('DELETE FROM projects WHERE project_id = ?').run(projectId);
    const taskCount = (db.raw.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n;
    expect(taskCount).toBe(0);
  });

  it('load throws NotFound for missing project', () => {
    expect(() => repo.load(9999)).toThrow(NotFoundError);
  });

  it('CHECK constraint blocks invalid progress at DB layer', () => {
    repo.createProject({ name: 'P', description: '' });
    expect(() =>
      db.raw
        .prepare(
          `INSERT INTO tasks(project_id, parent_task_id, name, assignee, start_date, due_date, progress, description)
           VALUES (1, NULL, 't', '', '2026-01-01', '2026-01-10', 200, '')`,
        )
        .run(),
    ).toThrow();
  });

  it('UNIQUE constraint blocks duplicate dependency at DB layer', () => {
    repo.createProject({ name: 'P', description: '' });
    const wbs = repo.load(1);
    wbs.addTask({
      taskId: 1,
      name: 't1',
      assignee: '',
      period: TaskPeriod.of('2026-01-01', '2026-01-10'),
      progress: TaskProgress.of(0),
      parentTaskId: null,
      description: '',
    });
    wbs.addTask({
      taskId: 2,
      name: 't2',
      assignee: '',
      period: TaskPeriod.of('2026-01-11', '2026-01-20'),
      progress: TaskProgress.of(0),
      parentTaskId: null,
      description: '',
    });
    wbs.addDependency({ dependencyId: 1, predecessorTaskId: 1, successorTaskId: 2 });
    repo.save(wbs);

    // 直接 DB に重複を入れようとすると拒否される
    expect(() =>
      db.raw
        .prepare('INSERT INTO dependencies(predecessor_task_id, successor_task_id) VALUES (?, ?)')
        .run(1, 2),
    ).toThrow();
  });
});
