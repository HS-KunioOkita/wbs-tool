import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database as Db } from 'better-sqlite3';

/**
 * T-015 スキーマ移行機構（OPEN-03 確定: 起動時自動適用）。
 * - `schema_version` テーブルに適用済みバージョンを記録
 * - migrations/NNN_*.sql を順に走査し、未適用のものを順次適用
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface MigrationResult {
  appliedVersions: number[];
}

export function runMigrations(db: Db): MigrationResult {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_version').all() as Array<{ version: number }>).map(
      (r) => r.version,
    ),
  );

  const files = readdirSync(__dirname)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();

  const appliedVersions: number[] = [];
  for (const file of files) {
    const version = Number.parseInt(file.slice(0, 3), 10);
    if (applied.has(version)) continue;

    const sql = readFileSync(path.join(__dirname, file), 'utf8');
    const insertStmt = db.prepare('INSERT INTO schema_version(version, applied_at) VALUES (?, ?)');

    const tx = db.transaction(() => {
      db.exec(sql);
      insertStmt.run(version, new Date().toISOString());
    });
    tx();

    appliedVersions.push(version);
  }

  return { appliedVersions };
}
