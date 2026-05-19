import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse } from '@wbs-tool/shared';
import { ERROR_CODE } from '@wbs-tool/shared';
import {
  AppError,
  BusinessRuleViolationError,
  InputInvalidError,
  InternalError,
  NotFoundError,
  PersistenceFailureError,
} from '../../errors/app-errors.js';
import type { Logger } from '../../logging/logger.js';

function httpStatusFor(err: AppError): number {
  if (err instanceof InputInvalidError) return 400;
  if (err instanceof BusinessRuleViolationError) {
    // 重複系（VR-006）は 409、それ以外は 422（インタフェース設計書 §4.1）
    if (err.details.includes('VR-006')) return 409;
    return 422;
  }
  if (err instanceof NotFoundError) return 404;
  if (err instanceof PersistenceFailureError) return 500;
  if (err instanceof InternalError) return 500;
  return 500;
}

export function createErrorHandler(logger: Logger) {
  return (err: FastifyError, request: FastifyRequest, reply: FastifyReply): void => {
    const correlationId =
      typeof request.headers['x-correlation-id'] === 'string'
        ? request.headers['x-correlation-id']
        : (request.id ?? 'unknown');

    if (err instanceof AppError) {
      const status = httpStatusFor(err);
      // 業務由来のエラーは INFO / WARN ログ。ERR-005/006 のみ ERROR + stack。
      if (err instanceof PersistenceFailureError || err instanceof InternalError) {
        logger.error(err.message, {
          correlationId,
          code: err.code,
          stack: err.stack,
        });
      } else if (err instanceof NotFoundError) {
        logger.warn(err.message, { correlationId, code: err.code });
      } else {
        logger.info(err.message, { correlationId, code: err.code, details: err.details });
      }
      const body: ApiErrorResponse = {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details.length > 0 ? { details: err.details } : {}),
          ...(err.field !== undefined ? { field: err.field } : {}),
        },
        correlationId,
      };
      void reply.status(status).send(body);
      return;
    }

    // Fastify が出した 4xx（バリデーション等）は ERR-001 として扱う
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      const body: ApiErrorResponse = {
        error: {
          code: ERROR_CODE.INPUT_INVALID,
          message: err.message,
        },
        correlationId,
      };
      void reply.status(err.statusCode).send(body);
      return;
    }

    // 予期せぬ例外は ERR-006
    logger.error('unhandled error', {
      correlationId,
      stack: err.stack,
      message: err.message,
    });
    const body: ApiErrorResponse = {
      error: {
        code: ERROR_CODE.INTERNAL,
        message: 'internal error',
      },
      correlationId,
    };
    void reply.status(500).send(body);
  };
}
