import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/features/wbs/gantt/coordinates.js';
import { computeDragResult, hasChildren } from '../../src/features/wbs/gantt/drag.js';

const layout = computeLayout({
  tasks: [{ start_date: '2026-02-10', due_date: '2026-02-20' }],
  granularity: 'day',
});

describe('computeDragResult', () => {
  const base = {
    originalStartDate: '2026-02-10',
    originalDueDate: '2026-02-20',
    layout,
  } as const;

  describe('move (バー全体)', () => {
    it('shifts both ends by snapped days', () => {
      const r = computeDragResult({ ...base, mode: 'move', deltaPx: layout.pxPerDay * 3.1 });
      expect(r.startDate).toBe('2026-02-13');
      expect(r.dueDate).toBe('2026-02-23');
      expect(r.valid).toBe(true);
    });

    it('zero delta is a no-op', () => {
      const r = computeDragResult({ ...base, mode: 'move', deltaPx: 0 });
      expect(r.startDate).toBe('2026-02-10');
      expect(r.dueDate).toBe('2026-02-20');
    });

    it('negative delta shifts left', () => {
      const r = computeDragResult({ ...base, mode: 'move', deltaPx: -layout.pxPerDay * 2 });
      expect(r.startDate).toBe('2026-02-08');
      expect(r.dueDate).toBe('2026-02-18');
    });
  });

  describe('resize-left (左端: 開始日のみ変更)', () => {
    it('changes only start, keeps due', () => {
      const r = computeDragResult({
        ...base,
        mode: 'resize-left',
        deltaPx: layout.pxPerDay * 2,
      });
      expect(r.startDate).toBe('2026-02-12');
      expect(r.dueDate).toBe('2026-02-20');
      expect(r.valid).toBe(true);
    });

    it('VR-002: start > due is invalid', () => {
      const r = computeDragResult({
        ...base,
        mode: 'resize-left',
        deltaPx: layout.pxPerDay * 20,
      });
      expect(r.valid).toBe(false);
    });
  });

  describe('resize-right (右端: 期限のみ変更)', () => {
    it('changes only due, keeps start', () => {
      const r = computeDragResult({
        ...base,
        mode: 'resize-right',
        deltaPx: layout.pxPerDay * 3,
      });
      expect(r.startDate).toBe('2026-02-10');
      expect(r.dueDate).toBe('2026-02-23');
      expect(r.valid).toBe(true);
    });

    it('VR-002: due < start is invalid', () => {
      const r = computeDragResult({
        ...base,
        mode: 'resize-right',
        deltaPx: -layout.pxPerDay * 20,
      });
      expect(r.valid).toBe(false);
    });
  });
});

describe('hasChildren', () => {
  const tasks = [
    { task_id: 1, parent_task_id: null },
    { task_id: 2, parent_task_id: 1 },
    { task_id: 3, parent_task_id: null },
  ];

  it('returns true when at least one task points to it', () => {
    expect(hasChildren(1, tasks)).toBe(true);
  });

  it('returns false otherwise', () => {
    expect(hasChildren(2, tasks)).toBe(false);
    expect(hasChildren(3, tasks)).toBe(false);
  });
});
