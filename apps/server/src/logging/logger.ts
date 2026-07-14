import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * COMP-008 ロギング。
 * 標準出力 + ローカルファイル、INFO / WARN / ERROR の 3 段階。
 * 監視基盤連携は持たない（NFR-004）。
 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export interface LoggerOptions {
  logPath?: string | undefined;
  minLevel?: LogLevel;
}

const LEVEL_ORDER: Record<LogLevel, number> = { INFO: 0, WARN: 1, ERROR: 2 };

export function createLogger(options: LoggerOptions = {}): Logger {
  const minLevel = options.minLevel ?? 'INFO';
  const filePath = options.logPath;

  if (filePath) {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const write = (level: LogLevel, message: string, context?: LogContext): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(context ?? {}),
    };
    const line = JSON.stringify(entry);

    // 標準出力
    if (level === 'ERROR') {
      console.error(line);
    } else if (level === 'WARN') {
      console.warn(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }

    // ファイル
    if (filePath) {
      try {
        appendFileSync(filePath, line + '\n', 'utf8');
      } catch {
        // ログ書き込みの失敗は業務処理に影響させない（LNK-008）
      }
    }
  };

  return {
    info: (message, context) => write('INFO', message, context),
    warn: (message, context) => write('WARN', message, context),
    error: (message, context) => write('ERROR', message, context),
  };
}
