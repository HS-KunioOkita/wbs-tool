import { ERROR_CODE, type ErrorCode } from '@wbs-tool/shared';

/**
 * 全アプリ例外の基底クラス。
 * インタフェース設計書 §4.1 の ERR-NNN にマップされる。
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  /** VR-NNN / RULE-NNN 等の詳細参照（複数可）。 */
  readonly details: string[];
  /** 該当フィールド名（VR 違反時）。 */
  readonly field: string | undefined;

  constructor(message: string, options?: { details?: string[]; field?: string }) {
    super(message);
    this.name = this.constructor.name;
    this.details = options?.details ?? [];
    this.field = options?.field;
  }
}

/** ERR-001 入力不正（VR-001 / VR-002 / VR-003 / VR-005 / VR-009 / VR-011 等） */
export class InputInvalidError extends AppError {
  readonly code = ERROR_CODE.INPUT_INVALID;
}

/** ERR-002 業務ルール違反（VR-004 / VR-006 / VR-007 / VR-008 / VR-010） */
export class BusinessRuleViolationError extends AppError {
  readonly code = ERROR_CODE.BUSINESS_RULE_VIOLATION;
}

/** ERR-003 対象が存在しない */
export class NotFoundError extends AppError {
  readonly code = ERROR_CODE.NOT_FOUND;
}

/** ERR-005 永続化失敗（SQLite I/O） */
export class PersistenceFailureError extends AppError {
  readonly code = ERROR_CODE.PERSISTENCE_FAILURE;

  constructor(
    message: string,
    public readonly cause?: unknown,
    options?: { details?: string[] },
  ) {
    super(message, options);
  }
}

/** ERR-006 予期せぬシステム内部例外 */
export class InternalError extends AppError {
  readonly code = ERROR_CODE.INTERNAL;

  constructor(
    message: string,
    public readonly cause?: unknown,
    options?: { details?: string[] },
  ) {
    super(message, options);
  }
}
