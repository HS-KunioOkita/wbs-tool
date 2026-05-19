import type { ApiErrorResponse, ErrorCode } from '@wbs-tool/shared';

/**
 * API クライアントが投げる例外。ERR-NNN とメッセージを保持する。
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly correlationId: string;
  readonly details: string[];
  readonly field: string | undefined;

  constructor(payload: ApiErrorResponse, httpStatus: number) {
    super(payload.error.message);
    this.name = 'ApiError';
    this.code = payload.error.code;
    this.httpStatus = httpStatus;
    this.correlationId = payload.correlationId;
    this.details = payload.error.details ?? [];
    this.field = payload.error.field;
  }
}
