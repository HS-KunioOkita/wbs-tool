import { loadConfig } from './config/config.js';
import { openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrations/runner.js';
import { createLogger } from './logging/logger.js';
import { buildServer } from './http/server.js';

/**
 * エントリポイント。フェーズ 1 では API ルートは未実装で、起動 / マイグレーション /
 * 整合性チェック / ヘルスチェックのみを提供する。
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ logPath: config.logPath, minLevel: config.logLevel });

  logger.info('starting wbs-tool server', {
    port: config.port,
    dbPath: config.dbPath,
  });

  const db = openDatabase(config.dbPath, { runIntegrityCheck: true });
  const migrationResult = runMigrations(db.raw);
  if (migrationResult.appliedVersions.length > 0) {
    logger.info('applied migrations', { versions: migrationResult.appliedVersions });
  }

  const server = await buildServer({
    logger,
    db: db.raw,
    serveStatic: config.serveStatic,
    webDistPath: config.webDistPath,
  });

  // ポート占有時のフォールバック（T-064 に対応する最小実装）
  const tryListen = async (port: number): Promise<number> => {
    try {
      await server.listen({ host: config.host, port });
      return port;
    } catch (err) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code?: string }).code === 'EADDRINUSE' &&
        port === config.port
      ) {
        logger.warn(`port ${port} in use, falling back to ${config.fallbackPort}`);
        return tryListen(config.fallbackPort);
      }
      throw err;
    }
  };

  const boundPort = await tryListen(config.port);
  logger.info(`listening on http://${config.host}:${boundPort}`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`received ${signal}, shutting down`);
    await server.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal startup error', err);
  process.exit(1);
});
