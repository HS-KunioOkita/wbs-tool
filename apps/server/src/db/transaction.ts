import type { Database as Db } from 'better-sqlite3';
import { AppError, PersistenceFailureError } from '../errors/app-errors.js';

/**
 * T-020 トランザクション境界制御。
 * better-sqlite3 の同期トランザクション機構をラップし、業務例外（AppError 系）は
 * そのまま再 throw、SQLite I/O 由来のエラーは ERR-005 に翻訳して上位に伝搬する。
 */
export function runInTransaction<T>(db: Db, work: () => T): T {
  const tx = db.transaction(work);
  try {
    return tx.immediate();
  } catch (err) {
    if (err instanceof AppError) throw err;
    // better-sqlite3 由来のエラー（`code` を持つ）は ERR-005 に翻訳
    if (
      err instanceof Error &&
      'code' in err &&
      typeof (err as { code: unknown }).code === 'string'
    ) {
      throw new PersistenceFailureError(err.message, err);
    }
    throw err;
  }
}
