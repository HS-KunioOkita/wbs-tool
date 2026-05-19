import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  chartHeight,
  chartWidth,
  computeLayout,
  dateToX,
  diffDays,
  HEADER_HEIGHT,
  makeDayTicks,
  makeMonthTicks,
  PADDING_DAYS,
  ROW_GAP,
  ROW_HEIGHT,
  rowToY,
  xToDateSnapped,
} from '../../src/features/wbs/gantt/coordinates.js';

describe('coordinates', () => {
  describe('date arithmetic', () => {
    it('diffDays returns whole days', () => {
      expect(diffDays('2026-01-01', '2026-01-01')).toBe(0);
      expect(diffDays('2026-01-01', '2026-01-10')).toBe(9);
      expect(diffDays('2026-01-31', '2026-02-01')).toBe(1);
    });
    it('addDaysIso handles negative offsets and month rollover', () => {
      expect(addDaysIso('2026-01-05', -10)).toBe('2025-12-26');
      expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
      expect(addDaysIso('2026-02-28', 1)).toBe('2026-03-01');
    });
  });

  describe('computeLayout', () => {
    it('uses min/max of tasks with padding', () => {
      const layout = computeLayout({
        tasks: [
          { start_date: '2026-02-10', due_date: '2026-02-15' },
          { start_date: '2026-02-12', due_date: '2026-02-20' },
        ],
        granularity: 'day',
      });
      expect(layout.originDate).toBe(addDaysIso('2026-02-10', -PADDING_DAYS));
      expect(layout.pxPerDay).toBeGreaterThan(0);
      expect(layout.totalDays).toBe(diffDays(layout.originDate, '2026-02-20') + PADDING_DAYS + 1);
    });

    it('handles empty task list without crashing', () => {
      const layout = computeLayout({ tasks: [], granularity: 'day' });
      expect(layout.totalDays).toBe(PADDING_DAYS * 2 + 1);
    });

    it('uses different pxPerDay for granularity', () => {
      const day = computeLayout({ tasks: [], granularity: 'day' });
      const month = computeLayout({ tasks: [], granularity: 'month' });
      expect(day.pxPerDay).toBeGreaterThan(month.pxPerDay);
    });
  });

  describe('dateToX / xToDateSnapped', () => {
    const layout = computeLayout({
      tasks: [{ start_date: '2026-02-10', due_date: '2026-02-20' }],
      granularity: 'day',
    });

    it('is identity through round-trip on grid dates', () => {
      const target = '2026-02-15';
      const x = dateToX(target, layout);
      expect(xToDateSnapped(x, layout)).toBe(target);
    });

    it('snaps mid-cell x values to nearest day (UC-007)', () => {
      const x = dateToX('2026-02-15', layout) + layout.pxPerDay * 0.4;
      expect(xToDateSnapped(x, layout)).toBe('2026-02-15');
      const x2 = dateToX('2026-02-15', layout) + layout.pxPerDay * 0.6;
      expect(xToDateSnapped(x2, layout)).toBe('2026-02-16');
    });
  });

  describe('rowToY / chart dimensions', () => {
    const layout = computeLayout({ tasks: [], granularity: 'day' });

    it('row 0 starts below the header', () => {
      expect(rowToY(0, layout)).toBe(HEADER_HEIGHT);
    });

    it('rows are evenly spaced', () => {
      expect(rowToY(2, layout) - rowToY(1, layout)).toBe(ROW_HEIGHT + ROW_GAP);
    });

    it('chartWidth scales with totalDays', () => {
      expect(chartWidth(layout)).toBe(layout.totalDays * layout.pxPerDay);
    });

    it('chartHeight grows with rowCount', () => {
      const baseline = chartHeight(0, layout);
      expect(chartHeight(10, layout) - baseline).toBe(10 * (ROW_HEIGHT + ROW_GAP));
    });
  });

  describe('tick generation', () => {
    it('makeDayTicks produces totalDays ticks, marking month starts', () => {
      const layout = computeLayout({
        tasks: [{ start_date: '2026-01-29', due_date: '2026-02-03' }],
        granularity: 'day',
      });
      const ticks = makeDayTicks(layout);
      expect(ticks).toHaveLength(layout.totalDays);
      const monthStarts = ticks.filter((t) => t.isMonthStart).map((t) => t.date);
      expect(monthStarts).toContain('2026-02-01');
    });

    it('makeMonthTicks produces one tick per month spanned', () => {
      const layout = computeLayout({
        tasks: [{ start_date: '2026-01-10', due_date: '2026-03-05' }],
        granularity: 'month',
      });
      const ticks = makeMonthTicks(layout);
      const labels = ticks.map((t) => t.label);
      expect(labels).toEqual(['2026/01', '2026/02', '2026/03']);
    });

    it('makeMonthTicks splits at year boundary', () => {
      const layout = computeLayout({
        tasks: [{ start_date: '2025-12-25', due_date: '2026-01-05' }],
        granularity: 'month',
      });
      const labels = makeMonthTicks(layout).map((t) => t.label);
      expect(labels).toContain('2025/12');
      expect(labels).toContain('2026/01');
    });
  });
});
