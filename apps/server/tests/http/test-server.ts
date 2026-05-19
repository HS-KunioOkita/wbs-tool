import type { FastifyInstance } from 'fastify';
import { openDatabase, type SqliteDb } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations/runner.js';
import { buildServer } from '../../src/http/server.js';
import { createLogger } from '../../src/logging/logger.js';

export interface TestContext {
  app: FastifyInstance;
  db: SqliteDb;
  close: () => Promise<void>;
}

/**
 * インメモリ SQLite + 静かなロガーで Fastify サーバを構築する。
 * 各テストの beforeEach で呼び、afterEach で close する。
 */
export async function buildTestContext(): Promise<TestContext> {
  const db = openDatabase(':memory:', { runIntegrityCheck: false });
  runMigrations(db.raw);
  const logger = createLogger({ minLevel: 'ERROR' }); // テスト中は ERROR 以上のみ標準出力
  const app = await buildServer({ logger, db: db.raw });
  return {
    app,
    db,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}
