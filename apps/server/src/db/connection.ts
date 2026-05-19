import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Database as Db } from 'better-sqlite3';
import { PersistenceFailureError } from '../errors/app-errors.js';

/**
 * T-014 SQLite 接続管理。
 * - `PRAGMA foreign_keys = ON` を有効化
 * - 起動時 `PRAGMA integrity_check` で破損検知（破損は呼び出し側に通知）
 */
export interface OpenDatabaseOptions {
  /** 起動時に integrity_check を実行するか。テストでは false を許容。 */
  runIntegrityCheck?: boolean;
}

export interface SqliteDb {
  readonly raw: Db;
  close(): void;
}

export function openDatabase(filePath: string, options: OpenDatabaseOptions = {}): SqliteDb {
  if (filePath !== ':memory:') {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const raw: Db = new Database(filePath);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  if (options.runIntegrityCheck) {
    const rows = raw.pragma('integrity_check') as Array<{ integrity_check: string }>;
    const ok = rows.length === 1 && rows[0]?.integrity_check === 'ok';
    if (!ok) {
      raw.close();
      throw new PersistenceFailureError(
        `SQLite integrity_check failed for ${filePath}: ${JSON.stringify(rows)}`,
      );
    }
  }

  return {
    raw,
    close: () => raw.close(),
  };
}
