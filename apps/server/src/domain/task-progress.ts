import { VR } from '@wbs-tool/shared';
import { InputInvalidError } from '../errors/app-errors.js';

/**
 * CLS-003 タスク進捗（値オブジェクト）。
 * 0〜100 の整数を生成時に保証する。
 */
export class TaskProgress {
  private constructor(public readonly value: number) {}

  static of(value: number): TaskProgress {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new InputInvalidError('progress must be an integer in [0, 100]', {
        details: [VR.TASK_PROGRESS_RANGE],
      });
    }
    return new TaskProgress(value);
  }

  isCompleted(): boolean {
    return this.value === 100;
  }

  equals(other: unknown): boolean {
    return other instanceof TaskProgress && other.value === this.value;
  }
}
