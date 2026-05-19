import { VR, isPeriodOrdered, isDifferentTaskPair, isFilterRangeOrdered } from '@wbs-tool/shared';

/**
 * フォーム側の即時検証ヘルパ。VR-NNN を ID で参照し、サーバ側と同じロジックを使う。
 * 戻り値はエラーメッセージ（`null` = OK）。実際の文言は呼出側で日本語化する。
 */

export interface FieldError {
  message: string;
  code: string;
}

export function validateRequired(value: string, vrCode: string): FieldError | null {
  if (!value || value.trim().length === 0) {
    return { code: vrCode, message: '必須項目です' };
  }
  return null;
}

export function validateProjectName(value: string): FieldError | null {
  return validateRequired(value, VR.PROJECT_NAME_REQUIRED);
}

export function validateTaskName(value: string): FieldError | null {
  return validateRequired(value, VR.TASK_NAME_REQUIRED);
}

export function validateTaskPeriod(start: string, due: string): FieldError | null {
  if (!start || !due) return { code: VR.TASK_PERIOD_ORDERED, message: '日付を入力してください' };
  if (!isPeriodOrdered(start, due)) {
    return { code: VR.TASK_PERIOD_ORDERED, message: '開始日は期限以下にしてください' };
  }
  return null;
}

export function validateProgress(value: number): FieldError | null {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return { code: VR.TASK_PROGRESS_RANGE, message: '0〜100 の整数で入力してください' };
  }
  return null;
}

export function validateDependencyPair(predecessor: number, successor: number): FieldError | null {
  if (!isDifferentTaskPair(predecessor, successor)) {
    return { code: VR.DEP_NOT_SELF, message: '先行と後続に同じタスクは指定できません' };
  }
  return null;
}

export function validateFilterRange(from: string | null, to: string | null): FieldError | null {
  if (!isFilterRangeOrdered(from, to)) {
    return { code: VR.FILTER_RANGE_ORDERED, message: '開始は終了以下にしてください' };
  }
  return null;
}
