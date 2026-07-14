import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
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
  /** true のとき、ビルド済み SPA（webDistPath）を同一オリジンで配信する（常駐運用向け）。 */
  serveStatic?: boolean;
  /** 配信する SPA の dist パス。serveStatic が true のときのみ参照される。 */
  webDistPath?: string;
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

  // 常駐運用: ビルド済み SPA を同一オリジンで配信する（SERVE_STATIC=true のときのみ）。
  // wildcard:false により、実在する静的ファイルのみ直接配信し、それ以外は notFound へ委譲する。
  const serveStatic = options.serveStatic === true && options.webDistPath !== undefined;
  if (serveStatic) {
    await app.register(fastifyStatic, {
      root: options.webDistPath as string,
      wildcard: false,
    });
  }

  app.addHook('onRequest', async (req, reply) => {
    void reply.header('x-correlation-id', req.id);
  });

  app.setErrorHandler(createErrorHandler(options.logger));

  app.setNotFoundHandler((req, reply) => {
    // SPA 配信時は、API 以外の GET をクライアントルーティング用に index.html へフォールバックする。
    if (serveStatic && req.method === 'GET' && !req.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
    throw new NotFoundError(`route not found: ${req.method} ${req.url}`);
  });

  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/version', async () => ({ version: '0.1.0' }));

  registerProjectRoutes(app, options.db);
  registerTaskRoutes(app, options.db);
  registerDependencyRoutes(app, options.db);

  return app;
}
