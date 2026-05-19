/**
 * インタフェース設計書 §4.1 のエラーカタログ。
 * クライアント／サーバ双方で同一 ID を参照する。
 */
export const ERROR_CODE = {
  INPUT_INVALID: 'ERR-001',
  BUSINESS_RULE_VIOLATION: 'ERR-002',
  NOT_FOUND: 'ERR-003',
  CLIENT_SUPPRESSED: 'ERR-004',
  PERSISTENCE_FAILURE: 'ERR-005',
  INTERNAL: 'ERR-006',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    /** VR-NNN / RULE-NNN 等、機械可読な詳細参照。複数可。 */
    details?: string[];
    /** 該当フィールド名（VR 違反時）。 */
    field?: string;
  };
  correlationId: string;
}
