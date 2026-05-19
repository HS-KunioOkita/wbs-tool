import { z } from 'zod';

/**
 * インタフェース設計書 付録 A の VR-NNN。
 * クライアントの即時検証とサーバの最終検証で同一ロジックを共有する。
 */
export const VR = {
  TASK_NAME_REQUIRED: 'VR-001',
  TASK_PERIOD_ORDERED: 'VR-002',
  TASK_PROGRESS_RANGE: 'VR-003',
  TASK_PARENT_NO_CYCLE: 'VR-004',
  DEP_NOT_SELF: 'VR-005',
  DEP_NO_DUPLICATE: 'VR-006',
  DEP_NO_CYCLE: 'VR-007',
  SAME_PROJECT: 'VR-008',
  PROJECT_NAME_REQUIRED: 'VR-009',
  PARENT_FIELDS_READONLY: 'VR-010',
  FILTER_RANGE_ORDERED: 'VR-011',
} as const;

export type VrCode = (typeof VR)[keyof typeof VR];

const trimmed = z.string().transform((s) => s.trim());

// VR-009: プロジェクト名は必須・空文字不可
export const projectNameSchema = trimmed.pipe(z.string().min(1, VR.PROJECT_NAME_REQUIRED));

// VR-001: タスク名は必須・空文字不可
export const taskNameSchema = trimmed.pipe(z.string().min(1, VR.TASK_NAME_REQUIRED));

// VR-003: progress は 0〜100 の整数
export const progressSchema = z.number().int().min(0).max(100);

// 日付（ISO 8601 YYYY-MM-DD）
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'invalid date');

/**
 * VR-002: start_date <= due_date。
 * 文字列日付の辞書順比較で OK（ISO 8601 同形式のため）。
 */
export function isPeriodOrdered(startDate: string, dueDate: string): boolean {
  return startDate <= dueDate;
}

/**
 * VR-005: predecessor !== successor。
 */
export function isDifferentTaskPair(predecessorTaskId: number, successorTaskId: number): boolean {
  return predecessorTaskId !== successorTaskId;
}

/**
 * VR-011: フィルタ範囲は from <= to。
 * どちらかが未指定なら true。
 */
export function isFilterRangeOrdered(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!from || !to) return true;
  return from <= to;
}
