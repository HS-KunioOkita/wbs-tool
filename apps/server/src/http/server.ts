import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { Database as Db } from 'better-sqlite3';
import { NotFoundError } from '../errors/app-errors.js';
import type { Logger } from '../logging/logger.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerDependencyRoutes } from './routes/dependencies.js';

export interface BuildServerOptions {
  logger: Logger;
  db: Db;
}

/**
 * T-012/T-013 HTTP サーバ組み立て。
 * - 相関 ID 採番（X-Correlation-Id ヘッダ）
 * - CORS（localhost 限定 / OPEN-08 確定後、自動でホワイトリスト調整）
 * - 共通エラーハンドラ
 * - ルートは次フェーズ。今は /healthz と /version のみ実装。
 */
export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    genReqId: (req) => {
      const headerValue = req.headers['x-correlation-id'];
      if (typeof headerValue === 'string' && headerValue.length > 0) return headerValue;
      return randomUUID();
    },
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // localhost 限定。Origin ヘッダが無い同一オリジン呼出は許可。
      if (!origin) return cb(null, true);
      try {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return cb(null, true);
      } catch {
        // fallthrough
      }
      return cb(new Error('CORS: origin not allowed'), false);
    },
    credentials: false,
  });

  app.addHook('onRequest', async (req, reply) => {
    void reply.header('x-correlation-id', req.id);
  });

  app.setErrorHandler(createErrorHandler(options.logger));

  app.setNotFoundHandler((req) => {
    throw new NotFoundError(`route not found: ${req.method} ${req.url}`);
  });

  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/version', async () => ({ version: '0.1.0' }));

  registerProjectRoutes(app, options.db);
  registerTaskRoutes(app, options.db);
  registerDependencyRoutes(app, options.db);

  return app;
}
