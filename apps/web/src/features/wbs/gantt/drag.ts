import { addDaysIso, type GanttLayout } from './coordinates.js';

/**
 * ドラッグ操作の差分計算（純粋関数、UI 非依存）。
 * UC-007: バー全体 / 左端 / 右端の 3 モード、1 日単位スナップ、開始日 > 期限となる結果は抑止。
 */

export type DragMode = 'move' | 'resize-left' | 'resize-right';

export interface DragInput {
  readonly mode: DragMode;
  readonly originalStartDate: string;
  readonly originalDueDate: string;
  /** ピクセル単位の x 方向差分。 */
  readonly deltaPx: number;
  readonly layout: GanttLayout;
}

export interface DragResult {
  readonly startDate: string;
  readonly dueDate: string;
  /** true なら start ≤ due を満たし、確定可能。false ならドロップを抑止すべき（VR-002）。 */
  readonly valid: boolean;
}

export function computeDragResult(input: DragInput): DragResult {
  const deltaDays = Math.round(input.deltaPx / input.layout.pxPerDay);

  switch (input.mode) {
    case 'move': {
      const start = addDaysIso(input.originalStartDate, deltaDays);
      const due = addDaysIso(input.originalDueDate, deltaDays);
      return { startDate: start, dueDate: due, valid: start <= due };
    }
    case 'resize-left': {
      const start = addDaysIso(input.originalStartDate, deltaDays);
      return {
        startDate: start,
        dueDate: input.originalDueDate,
        valid: start <= input.originalDueDate,
      };
    }
    case 'resize-right': {
      const due = addDaysIso(input.originalDueDate, deltaDays);
      return {
        startDate: input.originalStartDate,
        dueDate: due,
        valid: input.originalStartDate <= due,
      };
    }
  }
}

/**
 * タスクが子を持つか（= 親タスクか）の判定。
 * VR-010 の UI 側抑止に使う。
 */
export function hasChildren(
  taskId: number,
  allTasks: ReadonlyArray<{ task_id: number; parent_task_id: number | null }>,
): boolean {
  return allTasks.some((t) => t.parent_task_id === taskId);
}
