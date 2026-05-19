import { describe, expect, it } from 'vitest';
import { TaskPeriod } from '../../src/domain/task-period.js';
import { InputInvalidError } from '../../src/errors/app-errors.js';

describe('CLS-002 TaskPeriod', () => {
  describe('VR-002 start_date <= due_date', () => {
    it('builds when start equals due', () => {
      const p = TaskPeriod.of('2026-01-01', '2026-01-01');
      expect(p.startDate).toBe('2026-01-01');
      expect(p.dueDate).toBe('2026-01-01');
    });

    it('builds when start < due', () => {
      const p = TaskPeriod.of('2026-01-01', '2026-12-31');
      expect(p.startDate).toBe('2026-01-01');
    });

    it('rejects when start > due', () => {
      expect(() => TaskPeriod.of('2026-12-31', '2026-01-01')).toThrow(InputInvalidError);
    });
  });

  describe('combine (RULE-009 helper)', () => {
    it('returns min start / max due', () => {
      const a = TaskPeriod.of('2026-01-10', '2026-01-20');
      const b = TaskPeriod.of('2026-01-05', '2026-01-15');
      const c = a.combine(b);
      expect(c.startDate).toBe('2026-01-05');
      expect(c.dueDate).toBe('2026-01-20');
    });

    it('is symmetric', () => {
      const a = TaskPeriod.of('2026-01-10', '2026-01-20');
      const b = TaskPeriod.of('2026-01-05', '2026-01-15');
      expect(a.combine(b).equals(b.combine(a))).toBe(true);
    });
  });

  describe('durationDays', () => {
    it('counts inclusive days', () => {
      expect(TaskPeriod.of('2026-01-01', '2026-01-01').durationDays()).toBe(1);
      expect(TaskPeriod.of('2026-01-01', '2026-01-10').durationDays()).toBe(10);
    });

    it('handles month boundary', () => {
      expect(TaskPeriod.of('2026-01-25', '2026-02-05').durationDays()).toBe(12);
    });
  });

  describe('equals', () => {
    it('equal when both fields match', () => {
      expect(
        TaskPeriod.of('2026-01-01', '2026-01-10').equals(TaskPeriod.of('2026-01-01', '2026-01-10')),
      ).toBe(true);
    });
    it('not equal otherwise', () => {
      expect(
        TaskPeriod.of('2026-01-01', '2026-01-10').equals(TaskPeriod.of('2026-01-02', '2026-01-10')),
      ).toBe(false);
    });
    it('not equal to non-TaskPeriod', () => {
      expect(TaskPeriod.of('2026-01-01', '2026-01-10').equals({ startDate: '2026-01-01' })).toBe(
        false,
      );
    });
  });
});
