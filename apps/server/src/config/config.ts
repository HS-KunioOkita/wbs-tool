import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * T-011 構成管理。
 * 環境変数を読み、既定値で穴埋めする。
 *
 * - PORT / FALLBACK_PORT: ローカルサーバの待ち受けポート。占有時はフォールバックへ。
 * - DB_PATH: SQLite ファイルパス。既定は ./data/wbs.sqlite。
 * - LOG_PATH: ログファイルパス。空文字なら標準出力のみ。
 * - SERVE_STATIC: true のとき Fastify がビルド済み SPA（apps/web/dist）を同一オリジンで配信する。
 * - WEB_DIST_PATH: 配信する SPA の dist パス。既定は apps/web/dist を相対解決する。
 */
export interface AppConfig {
  readonly port: number;
  readonly fallbackPort: number;
  readonly host: string;
  readonly dbPath: string;
  readonly logPath: string | undefined;
  readonly logLevel: 'INFO' | 'WARN' | 'ERROR';
  readonly serveStatic: boolean;
  readonly webDistPath: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/server/src/config → apps/web/dist
const DEFAULT_WEB_DIST = path.resolve(__dirname, '../../../web/dist');

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

function readEnvString(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw;
}

export function loadConfig(): AppConfig {
  const logPathRaw = process.env.LOG_PATH;
  const levelRaw = process.env.LOG_LEVEL?.toUpperCase();
  const logLevel: AppConfig['logLevel'] =
    levelRaw === 'WARN' || levelRaw === 'ERROR' ? levelRaw : 'INFO';

  return {
    port: readEnvInt('PORT', 5174),
    fallbackPort: readEnvInt('FALLBACK_PORT', 5184),
    host: readEnvString('HOST', '127.0.0.1'),
    dbPath: path.resolve(readEnvString('DB_PATH', './data/wbs.sqlite')),
    logPath: logPathRaw ? path.resolve(logPathRaw) : undefined,
    logLevel,
    serveStatic: process.env.SERVE_STATIC === 'true',
    webDistPath: path.resolve(readEnvString('WEB_DIST_PATH', DEFAULT_WEB_DIST)),
  };
}
