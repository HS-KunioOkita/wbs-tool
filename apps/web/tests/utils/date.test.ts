// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatDate, isOverdue, todayLocalIso } from '../../src/utils/date.js';

describe('utils/date', () => {
  describe('todayLocalIso', () => {
    it('returns a YYYY-MM-DD formatted string', () => {
      const t = todayLocalIso();
      expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('isOverdue (UC-006 期限超過視覚化対象判定)', () => {
    it('past due date with progress < 100 is overdue', () => {
      expect(isOverdue('2026-01-01', 50, '2026-05-19')).toBe(true);
    });

    it('past due date with progress = 100 is NOT overdue (UC-006 完了除外)', () => {
      expect(isOverdue('2026-01-01', 100, '2026-05-19')).toBe(false);
    });

    it('future due date is never overdue', () => {
      expect(isOverdue('2027-01-01', 0, '2026-05-19')).toBe(false);
    });

    it('today (same date) is not overdue', () => {
      expect(isOverdue('2026-05-19', 0, '2026-05-19')).toBe(false);
    });
  });

  describe('formatDate', () => {
    it('formats with slashes', () => {
      expect(formatDate('2026-05-19')).toBe('2026/05/19');
    });
    it('returns hyphen for null/empty', () => {
      expect(formatDate(null)).toBe('−');
      expect(formatDate(undefined)).toBe('−');
      expect(formatDate('')).toBe('−');
    });
  });
});
