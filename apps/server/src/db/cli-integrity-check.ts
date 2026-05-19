/**
 * `npm run db:check` から呼ばれる単体スクリプト。
 * `PRAGMA integrity_check` を実行し、結果を標準出力に書き出す。
 */
import { loadConfig } from '../config/config.js';
import { openDatabase } from './connection.js';

const config = loadConfig();
const db = openDatabase(config.dbPath, { runIntegrityCheck: false });
const rows = db.raw.pragma('integrity_check') as Array<{ integrity_check: string }>;
db.close();

const ok = rows.length === 1 && rows[0]?.integrity_check === 'ok';
// eslint-disable-next-line no-console
console.log(JSON.stringify({ path: config.dbPath, ok, rows }, null, 2));
process.exit(ok ? 0 : 1);
