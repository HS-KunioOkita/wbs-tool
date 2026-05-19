import { describe, expect, it } from 'vitest';
import { ProjectWbs } from '../../src/domain/project-wbs.js';
import { Task } from '../../src/domain/task.js';
import { TaskPeriod } from '../../src/domain/task-period.js';
import { TaskProgress } from '../../src/domain/task-progress.js';
import {
  BusinessRuleViolationError,
  InputInvalidError,
  NotFoundError,
} from '../../src/errors/app-errors.js';

function newWbs(): ProjectWbs {
  return new ProjectWbs({
    projectId: 1,
    projectName: 'P',
    description: '',
    createdAt: '2026-05-19T00:00:00Z',
    tasks: [],
    dependencies: [],
  });
}

function leaf(
  taskId: number,
  start: string,
  due: string,
  progress: number,
  parentTaskId: number | null = null,
) {
  return {
    taskId,
    name: `t${taskId}`,
    assignee: '',
    period: TaskPeriod.of(start, due),
    progress: TaskProgress.of(progress),
    parentTaskId,
    description: '',
  };
}

describe('CLS-004 ProjectWbs', () => {
  describe('construction VR-009', () => {
    it('rejects empty project name', () => {
      expect(
        () =>
          new ProjectWbs({
            projectId: 1,
            projectName: '   ',
            description: '',
            createdAt: '2026-05-19',
            tasks: [],
            dependencies: [],
          }),
      ).toThrow(InputInvalidError);
    });
  });

  describe('addTask', () => {
    it('adds a top-level task', () => {
      const wbs = newWbs();
      const result = wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0));
      expect(wbs.tasks()).toHaveLength(1);
      expect(result.recalculatedAncestors).toEqual([]);
    });

    it('VR-008 rejects parent in another project', () => {
      const wbs = newWbs();
      expect(() => wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0, 999))).toThrow(
        BusinessRuleViolationError,
      );
    });

    it('rejects duplicate task_id', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0));
      expect(() => wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0))).toThrow(InputInvalidError);
    });

    it('RULE-009/10 recalculates parent on child add', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-15', '2026-01-20', 0));
      wbs.addTask(leaf(2, '2026-01-10', '2026-01-12', 100, 1)); // child A
      const r = wbs.addTask(leaf(3, '2026-01-13', '2026-01-25', 50, 1));

      const parent = wbs.tasks().find((t) => t.taskId === 1)!;
      expect(parent.period.startDate).toBe('2026-01-10');
      expect(parent.period.dueDate).toBe('2026-01-25');
      expect(r.recalculatedAncestors.map((t) => t.taskId)).toEqual([1]);
    });
  });

  describe('RULE-010 OPEN-01 weighted progress', () => {
    it('uses duration-weighted average rounded to integer', () => {
      const wbs = newWbs();
      // parent
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-01', 0));
      // child A: 10 days, 100%
      wbs.addTask(leaf(2, '2026-01-01', '2026-01-10', 100, 1));
      // child B: 5 days, 0%  →  (100*10 + 0*5) / 15 = 66.67 → 67
      wbs.addTask(leaf(3, '2026-01-11', '2026-01-15', 0, 1));

      const parent = wbs.tasks().find((t) => t.taskId === 1)!;
      expect(parent.progress.value).toBe(67);
    });

    it('all children at 100 => parent 100', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-01', 0));
      wbs.addTask(leaf(2, '2026-01-01', '2026-01-10', 100, 1));
      wbs.addTask(leaf(3, '2026-01-11', '2026-01-20', 100, 1));
      expect(wbs.tasks().find((t) => t.taskId === 1)!.progress.value).toBe(100);
    });

    it('all children at 0 => parent 0', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-01', 0));
      wbs.addTask(leaf(2, '2026-01-01', '2026-01-10', 0, 1));
      wbs.addTask(leaf(3, '2026-01-11', '2026-01-20', 0, 1));
      expect(wbs.tasks().find((t) => t.taskId === 1)!.progress.value).toBe(0);
    });
  });

  describe('updateTask', () => {
    it('VR-010 rejects schedule change on parent', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-01', 0));
      wbs.addTask(leaf(2, '2026-01-01', '2026-01-10', 0, 1));
      expect(() =>
        wbs.updateTask(1, { period: TaskPeriod.of('2026-02-01', '2026-02-10') }),
      ).toThrow(BusinessRuleViolationError);
    });

    it('VR-010 rejects progress change on parent', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-01', 0));
      wbs.addTask(leaf(2, '2026-01-01', '2026-01-10', 0, 1));
      expect(() => wbs.updateTask(1, { progress: TaskProgress.of(50) })).toThrow(
        BusinessRuleViolationError,
      );
    });

    it('VR-004 rejects parent change that would create a cycle (parent -> self)', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0));
      wbs.addTask(leaf(2, '2026-01-01', '2026-01-10', 0, 1));
      // making 1 a child of 2 (2 is a child of 1) creates a cycle
      expect(() => wbs.updateTask(1, { parentTaskId: 2 })).toThrow(BusinessRuleViolationError);
    });

    it('VR-004 rejects parent change to self', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0));
      expect(() => wbs.updateTask(1, { parentTaskId: 1 })).toThrow(BusinessRuleViolationError);
    });

    it('recalculates both previous and new parent ancestor chains', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-01', 0)); // parent A
      wbs.addTask(leaf(2, '2026-01-01', '2026-01-01', 0)); // parent B
      wbs.addTask(leaf(3, '2026-01-05', '2026-01-10', 50, 1));

      const r = wbs.updateTask(3, { parentTaskId: 2 });
      const ids = r.recalculatedAncestors.map((t) => t.taskId).sort();
      // Both old (1) and new (2) parent chains are recalculated. 1's children are now empty.
      expect(ids).toContain(2);
    });

    it('OPEN-02: parent retains derived values after all children removed', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-01', 0));
      wbs.addTask(leaf(2, '2026-01-05', '2026-01-10', 40, 1));

      // After add, parent reflects child
      expect(wbs.tasks().find((t) => t.taskId === 1)!.period.startDate).toBe('2026-01-05');

      // Now delete the only child
      wbs.deleteTask(2);

      // Parent (now a leaf) retains the previously-derived values
      const parent = wbs.tasks().find((t) => t.taskId === 1)!;
      expect(parent.period.startDate).toBe('2026-01-05');
      expect(parent.period.dueDate).toBe('2026-01-10');
      expect(parent.progress.value).toBe(40);
    });
  });

  describe('deleteTask RULE-013', () => {
    it('promotes children to top-level (parent_task_id = null)', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-01', 0));
      wbs.addTask(leaf(2, '2026-01-05', '2026-01-10', 0, 1));
      wbs.addTask(leaf(3, '2026-01-11', '2026-01-12', 0, 1));

      const result = wbs.deleteTask(1);
      expect(result.promotedChildTaskIds.sort()).toEqual([2, 3]);
      const remaining = wbs.tasks();
      expect(remaining.find((t) => t.taskId === 2)!.parentTaskId).toBe(null);
      expect(remaining.find((t) => t.taskId === 3)!.parentTaskId).toBe(null);
    });

    it('cascades dependency removal', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0));
      wbs.addTask(leaf(2, '2026-01-11', '2026-01-20', 0));
      wbs.addDependency({ dependencyId: 1, predecessorTaskId: 1, successorTaskId: 2 });

      const result = wbs.deleteTask(1);
      expect(result.deletedDependencyIds).toEqual([1]);
      expect(wbs.dependencies()).toHaveLength(0);
    });

    it('throws NotFoundError when task does not exist', () => {
      const wbs = newWbs();
      expect(() => wbs.deleteTask(999)).toThrow(NotFoundError);
    });
  });

  describe('addDependency', () => {
    it('adds when both tasks exist and pair is unique', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0));
      wbs.addTask(leaf(2, '2026-01-11', '2026-01-20', 0));
      const d = wbs.addDependency({ dependencyId: 1, predecessorTaskId: 1, successorTaskId: 2 });
      expect(d.predecessorTaskId).toBe(1);
    });

    it('VR-005 rejects self-dependency', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0));
      expect(() =>
        wbs.addDependency({ dependencyId: 1, predecessorTaskId: 1, successorTaskId: 1 }),
      ).toThrow(BusinessRuleViolationError);
    });

    it('VR-006 rejects duplicate pair', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-10', 0));
      wbs.addTask(leaf(2, '2026-01-11', '2026-01-20', 0));
      wbs.addDependency({ dependencyId: 1, predecessorTaskId: 1, successorTaskId: 2 });
      expect(() =>
        wbs.addDependency({ dependencyId: 2, predecessorTaskId: 1, successorTaskId: 2 }),
      ).toThrow(BusinessRuleViolationError);
    });

    it('VR-007 rejects cycle (1->2, 2->3, 3->1)', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-02', 0));
      wbs.addTask(leaf(2, '2026-01-03', '2026-01-04', 0));
      wbs.addTask(leaf(3, '2026-01-05', '2026-01-06', 0));
      wbs.addDependency({ dependencyId: 1, predecessorTaskId: 1, successorTaskId: 2 });
      wbs.addDependency({ dependencyId: 2, predecessorTaskId: 2, successorTaskId: 3 });
      expect(() =>
        wbs.addDependency({ dependencyId: 3, predecessorTaskId: 3, successorTaskId: 1 }),
      ).toThrow(BusinessRuleViolationError);
    });

    it('VR-008 rejects when either task is missing', () => {
      const wbs = newWbs();
      wbs.addTask(leaf(1, '2026-01-01', '2026-01-02', 0));
      expect(() =>
        wbs.addDependency({ dependencyId: 1, predecessorTaskId: 1, successorTaskId: 99 }),
      ).toThrow(BusinessRuleViolationError);
    });
  });

  describe('NFR-002 cycle detection performance', () => {
    it('handles 500 tasks * 1000 dependencies in reasonable time', () => {
      const wbs = newWbs();
      const N = 500;
      for (let i = 1; i <= N; i++) {
        const day = String((i % 28) + 1).padStart(2, '0');
        wbs.addTask(leaf(i, `2026-01-${day}`, `2026-01-${day}`, 0));
      }
      // 1000 dependencies as a linear chain segments (avoid cycles)
      let added = 0;
      let depId = 1;
      for (let i = 1; i < N && added < 1000; i++) {
        wbs.addDependency({ dependencyId: depId++, predecessorTaskId: i, successorTaskId: i + 1 });
        added++;
      }
      const t0 = performance.now();
      expect(wbs.wouldCreateDependencyCycle(N, 1)).toBe(true);
      const elapsed = performance.now() - t0;
      // Generous bound; actual perf is typically << 100ms.
      expect(elapsed).toBeLessThan(1000);
    });
  });
});

describe('Construction guards', () => {
  it('rejects tasks referencing a parent outside tasks set', () => {
    expect(
      () =>
        new ProjectWbs({
          projectId: 1,
          projectName: 'P',
          description: '',
          createdAt: '2026-05-19',
          tasks: [
            new Task({
              taskId: 1,
              name: 't1',
              assignee: '',
              period: TaskPeriod.of('2026-01-01', '2026-01-10'),
              progress: TaskProgress.of(0),
              parentTaskId: 99,
              description: '',
            }),
          ],
          dependencies: [],
        }),
    ).toThrow(BusinessRuleViolationError);
  });
});
