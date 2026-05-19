/**
 * ガントチャートの座標計算（純粋関数）。
 * - 日付は ISO 8601 (YYYY-MM-DD) 文字列で扱う
 * - 表示粒度ごとに「1 日あたりの px 幅」を定義し、X 座標 ↔ 日付の変換を一本化する
 *
 * 設計参照: UI-003 §3.4 / UC-006 / UC-007（1 日単位スナップ）。
 */

export type Granularity = 'day' | 'month';

export interface GanttLayout {
  /** 表示範囲の開始日（含む）。 */
  readonly originDate: string;
  /** 1 日あたりの x 幅（px）。 */
  readonly pxPerDay: number;
  /** ヘッダ（タイムライン軸）の高さ（px）。 */
  readonly headerHeight: number;
  /** 1 行の高さ（px）。 */
  readonly rowHeight: number;
  /** 表示する総日数。 */
  readonly totalDays: number;
}

export interface ComputeLayoutInput {
  /** 表示対象のタスク群（空配列は呼出側でガード）。 */
  readonly tasks: ReadonlyArray<{ start_date: string; due_date: string }>;
  readonly granularity: Granularity;
}

export const HEADER_HEIGHT = 48;
export const ROW_HEIGHT = 32;
export const ROW_GAP = 4;
export const PADDING_DAYS = 7;

const PX_PER_DAY_BY_GRAN: Record<Granularity, number> = {
  day: 28,
  month: 6,
};

const MS_PER_DAY = 86_400_000;

/**
 * 全タスクの範囲 + 前後マージンから、ガントの描画範囲を決める。
 */
export function computeLayout(input: ComputeLayoutInput): GanttLayout {
  const pxPerDay = PX_PER_DAY_BY_GRAN[input.granularity];

  const dates = collectDates(input.tasks);
  const min = dates.min ?? todayIso();
  const max = dates.max ?? todayIso();

  const origin = addDaysIso(min, -PADDING_DAYS);
  const end = addDaysIso(max, PADDING_DAYS);
  const totalDays = diffDays(origin, end) + 1;

  return {
    originDate: origin,
    pxPerDay,
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
    totalDays,
  };
}

/** 日付 → x 座標（origin からの px オフセット）。 */
export function dateToX(date: string, layout: GanttLayout): number {
  return diffDays(layout.originDate, date) * layout.pxPerDay;
}

/**
 * x 座標 → 日付（YYYY-MM-DD）。1 日単位にスナップ（四捨五入）。
 * UC-007 「1 日単位でスナップ」を実現する基本演算。
 */
export function xToDateSnapped(x: number, layout: GanttLayout): string {
  const days = Math.round(x / layout.pxPerDay);
  return addDaysIso(layout.originDate, days);
}

/** 行インデックス → y 座標（ヘッダ高 + (row * 行高)）。 */
export function rowToY(rowIndex: number, layout: GanttLayout): number {
  return layout.headerHeight + rowIndex * (layout.rowHeight + ROW_GAP);
}

export function chartWidth(layout: GanttLayout): number {
  return layout.totalDays * layout.pxPerDay;
}

export function chartHeight(rowCount: number, layout: GanttLayout): number {
  return layout.headerHeight + rowCount * (layout.rowHeight + ROW_GAP);
}

// ============================================================
// 日付演算
// ============================================================

export function diffDays(fromIso: string, toIso: string): number {
  const from = parseIsoUtc(fromIso);
  const to = parseIsoUtc(toIso);
  return Math.round((to - from) / MS_PER_DAY);
}

export function addDaysIso(iso: string, days: number): string {
  const t = parseIsoUtc(iso) + days * MS_PER_DAY;
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoUtc(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function collectDates(tasks: ReadonlyArray<{ start_date: string; due_date: string }>): {
  min: string | null;
  max: string | null;
} {
  if (tasks.length === 0) return { min: null, max: null };
  let min = tasks[0]!.start_date;
  let max = tasks[0]!.due_date;
  for (const t of tasks) {
    if (t.start_date < min) min = t.start_date;
    if (t.due_date > max) max = t.due_date;
  }
  return { min, max };
}

// ============================================================
// タイムライン軸の刻み
// ============================================================

export interface TickDay {
  readonly date: string;
  readonly x: number;
  readonly isMonthStart: boolean;
}

export interface TickMonth {
  readonly label: string; // "2026/01"
  readonly x: number;
  readonly widthPx: number;
}

/** 日粒度: 日ごとの目盛り。月初は強調用にフラグ付与。 */
export function makeDayTicks(layout: GanttLayout): TickDay[] {
  const ticks: TickDay[] = [];
  for (let i = 0; i < layout.totalDays; i++) {
    const date = addDaysIso(layout.originDate, i);
    ticks.push({
      date,
      x: i * layout.pxPerDay,
      isMonthStart: date.slice(8, 10) === '01',
    });
  }
  return ticks;
}

/** 月粒度: 月ごとに集約。表示範囲をまたぐ月は両端切り詰めずに「全幅」を示す。 */
export function makeMonthTicks(layout: GanttLayout): TickMonth[] {
  const ticks: TickMonth[] = [];
  let cursor = layout.originDate;
  const endExclusive = addDaysIso(layout.originDate, layout.totalDays);
  while (cursor < endExclusive) {
    const year = Number(cursor.slice(0, 4));
    const month = Number(cursor.slice(5, 7));
    const firstOfNext = nextMonthFirst(year, month);
    const segmentEnd = firstOfNext < endExclusive ? firstOfNext : endExclusive;
    const widthDays = diffDays(cursor, segmentEnd);
    ticks.push({
      label: `${year}/${String(month).padStart(2, '0')}`,
      x: diffDays(layout.originDate, cursor) * layout.pxPerDay,
      widthPx: widthDays * layout.pxPerDay,
    });
    cursor = firstOfNext;
  }
  return ticks;
}

function nextMonthFirst(year: number, month: number): string {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}
