import { isPeriodOrdered, VR } from '@wbs-tool/shared';
import { InputInvalidError } from '../errors/app-errors.js';

/**
 * CLS-002 タスク期間（値オブジェクト）。
 * 不変・start_date ≤ due_date を生成時に保証する。
 */
export class TaskPeriod {
  private constructor(
    public readonly startDate: string,
    public readonly dueDate: string,
  ) {}

  static of(startDate: string, dueDate: string): TaskPeriod {
    if (!isPeriodOrdered(startDate, dueDate)) {
      throw new InputInvalidError('start_date must be <= due_date', {
        details: [VR.TASK_PERIOD_ORDERED],
      });
    }
    return new TaskPeriod(startDate, dueDate);
  }

  /**
   * RULE-009: 親期間 = 子の min(start_date) / max(due_date)。
   * 自身と other を合成した新インスタンスを返す。
   */
  combine(other: TaskPeriod): TaskPeriod {
    const start = this.startDate <= other.startDate ? this.startDate : other.startDate;
    const due = this.dueDate >= other.dueDate ? this.dueDate : other.dueDate;
    return new TaskPeriod(start, due);
  }

  equals(other: unknown): boolean {
    return (
      other instanceof TaskPeriod &&
      other.startDate === this.startDate &&
      other.dueDate === this.dueDate
    );
  }

  /**
   * 期間日数（両端含む）。
   * RULE-010 の進捗集約での重みに使用する。
   */
  durationDays(): number {
    const start = Date.UTC(
      Number(this.startDate.slice(0, 4)),
      Number(this.startDate.slice(5, 7)) - 1,
      Number(this.startDate.slice(8, 10)),
    );
    const due = Date.UTC(
      Number(this.dueDate.slice(0, 4)),
      Number(this.dueDate.slice(5, 7)) - 1,
      Number(this.dueDate.slice(8, 10)),
    );
    const MS_PER_DAY = 86_400_000;
    return Math.round((due - start) / MS_PER_DAY) + 1;
  }
}
