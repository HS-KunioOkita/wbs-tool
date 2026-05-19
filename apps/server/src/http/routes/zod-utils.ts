import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { InputInvalidError } from '../../errors/app-errors.js';

/**
 * Zod のパース失敗を ERR-001（VR 違反）に翻訳する。
 * details には refine が返した VR-NNN メッセージを抽出して載せる。
 */
export function parseOrThrow<T>(schema: ZodSchema<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (err) {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      const message = issue?.message ?? 'invalid input';
      const field = issue?.path.length ? String(issue.path[0]) : undefined;
      // refine の message に VR-NNN を入れている箇所はそれを details に
      const details = err.issues.map((i) => i.message).filter((m) => /^VR-\d{3}$/.test(m));
      throw new InputInvalidError(message, {
        ...(details.length > 0 ? { details } : {}),
        ...(field !== undefined ? { field } : {}),
      });
    }
    throw err;
  }
}
