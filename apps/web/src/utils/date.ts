/**
 * 期限超過判定（UI-003 / UC-006 の視覚化用）。
 *
 * 基準日は PC のローカル日付（YYYY-MM-DD）。
 * `progress = 100` のタスクは期限超過対象外（UC-006）。
 */
export function todayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOverdue(dueDate: string, progress: number, today = todayLocalIso()): boolean {
  if (progress >= 100) return false;
  return dueDate < today;
}

/** 日付を「2026/01/15」形式で表示。空入力はハイフン。 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '−';
  return iso.replaceAll('-', '/');
}
