import { describe, expect, it } from 'vitest';
import type { TaskDto } from '@wbs-tool/shared';
import { applyFilter, emptyFilter, isFilterActive } from '../src/features/wbs/filter.js';

function task(task_id: number, overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    task_id,
    project_id: 1,
    parent_task_id: null,
    name: `t${task_id}`,
    assignee: '',
    start_date: '2026-01-01',
    due_date: '2026-01-10',
    progress: 0,
    description: '',
    ...overrides,
  };
}

const tasks: TaskDto[] = [
  task(1, { assignee: '山田太郎', start_date: '2026-01-01', due_date: '2026-01-10' }),
  task(2, {
    assignee: '佐藤花子',
    start_date: '2026-02-01',
    due_date: '2026-02-15',
    parent_task_id: 1,
  }),
  task(3, {
    assignee: '山田太郎',
    start_date: '2026-03-01',
    due_date: '2026-03-10',
    parent_task_id: 1,
  }),
  task(4, { assignee: '鈴木一郎', start_date: '2026-04-01', due_date: '2026-04-30' }),
  task(5, {
    assignee: '山田次郎',
    start_date: '2026-05-01',
    due_date: '2026-05-10',
    parent_task_id: 3,
  }),
];

describe('filter logic (UC-008)', () => {
  describe('isFilterActive', () => {
    it('returns false for the empty filter', () => {
      expect(isFilterActive(emptyFilter)).toBe(false);
    });
    it('returns true when any field is set', () => {
      expect(isFilterActive({ ...emptyFilter, assignee: '山田' })).toBe(true);
      expect(isFilterActive({ ...emptyFilter, startFrom: '2026-01-01' })).toBe(true);
      expect(isFilterActive({ ...emptyFilter, parentTaskId: 1 })).toBe(true);
    });
  });

  describe('applyFilter', () => {
    it('passes through when filter is empty (returns a copy)', () => {
      const result = applyFilter(tasks, emptyFilter);
      expect(result).toHaveLength(tasks.length);
      expect(result).not.toBe(tasks);
    });

    it('assignee uses partial match (OPEN-05 暫定)', () => {
      const result = applyFilter(tasks, { ...emptyFilter, assignee: '山田' });
      expect(result.map((t) => t.task_id).sort()).toEqual([1, 3, 5]);
    });

    it('assignee trims surrounding whitespace before matching', () => {
      const result = applyFilter(tasks, { ...emptyFilter, assignee: '  山田  ' });
      expect(result.map((t) => t.task_id).sort()).toEqual([1, 3, 5]);
    });

    it('startFrom / startTo bound the start_date inclusively', () => {
      const result = applyFilter(tasks, {
        ...emptyFilter,
        startFrom: '2026-02-01',
        startTo: '2026-04-01',
      });
      expect(result.map((t) => t.task_id).sort()).toEqual([2, 3, 4]);
    });

    it('dueFrom / dueTo bound the due_date inclusively', () => {
      const result = applyFilter(tasks, {
        ...emptyFilter,
        dueFrom: '2026-03-10',
        dueTo: '2026-04-30',
      });
      expect(result.map((t) => t.task_id).sort()).toEqual([3, 4]);
    });

    it('parent filter with descendants includes the whole subtree', () => {
      const result = applyFilter(tasks, {
        ...emptyFilter,
        parentTaskId: 1,
        includeDescendants: true,
      });
      // 1 (root), 2, 3 (children of 1), 5 (child of 3) ⇒ subtree {1,2,3,5}
      expect(result.map((t) => t.task_id).sort()).toEqual([1, 2, 3, 5]);
    });

    it('parent filter without descendants includes only direct children + the root', () => {
      const result = applyFilter(tasks, {
        ...emptyFilter,
        parentTaskId: 1,
        includeDescendants: false,
      });
      expect(result.map((t) => t.task_id).sort()).toEqual([1, 2, 3]);
    });

    it('combines multiple criteria with AND semantics', () => {
      const result = applyFilter(tasks, {
        ...emptyFilter,
        assignee: '山田',
        parentTaskId: 1,
        includeDescendants: true,
      });
      // assignee includes 山田 AND in subtree of 1 ⇒ {1, 3, 5}
      expect(result.map((t) => t.task_id).sort()).toEqual([1, 3, 5]);
    });

    it('returns empty when no task matches', () => {
      const result = applyFilter(tasks, { ...emptyFilter, assignee: '存在しない人' });
      expect(result).toEqual([]);
    });
  });
});
