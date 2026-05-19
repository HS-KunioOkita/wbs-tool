import type { TaskDto } from '@wbs-tool/shared';

/**
 * UI-006 フィルタの状態（クライアント側保持）。
 * OPEN-05 に従い assignee は部分一致（暫定）。VR-011 は呼出側で事前検証する。
 */
export interface TaskFilter {
  readonly assignee: string;
  readonly startFrom: string | null;
  readonly startTo: string | null;
  readonly dueFrom: string | null;
  readonly dueTo: string | null;
  readonly parentTaskId: number | null;
  /** 親タスク絞り込みに「子孫を含むか」のフラグ。 */
  readonly includeDescendants: boolean;
}

export const emptyFilter: TaskFilter = {
  assignee: '',
  startFrom: null,
  startTo: null,
  dueFrom: null,
  dueTo: null,
  parentTaskId: null,
  includeDescendants: true,
};

export function isFilterActive(filter: TaskFilter): boolean {
  return (
    filter.assignee.trim() !== '' ||
    filter.startFrom !== null ||
    filter.startTo !== null ||
    filter.dueFrom !== null ||
    filter.dueTo !== null ||
    filter.parentTaskId !== null
  );
}

/**
 * クライアント側フィルタ適用（UC-008）。
 * - assignee: 部分一致（OPEN-05 暫定）。前後空白は除去して比較。
 * - 日付範囲: from <= task.{start|due} <= to。片側のみ指定でも動く。
 * - 親タスク: 指定タスク配下（子孫含む / 直下のみは includeDescendants で切替）。
 */
export function applyFilter(tasks: ReadonlyArray<TaskDto>, filter: TaskFilter): TaskDto[] {
  if (!isFilterActive(filter)) return [...tasks];

  const assigneeNeedle = filter.assignee.trim();

  // 親フィルタ用の子孫集合を事前構築
  const descendants =
    filter.parentTaskId !== null
      ? collectDescendants(tasks, filter.parentTaskId, filter.includeDescendants)
      : null;

  return tasks.filter((t) => {
    if (assigneeNeedle && !t.assignee.includes(assigneeNeedle)) return false;
    if (filter.startFrom && t.start_date < filter.startFrom) return false;
    if (filter.startTo && t.start_date > filter.startTo) return false;
    if (filter.dueFrom && t.due_date < filter.dueFrom) return false;
    if (filter.dueTo && t.due_date > filter.dueTo) return false;
    if (descendants && !descendants.has(t.task_id)) return false;
    return true;
  });
}

function collectDescendants(
  tasks: ReadonlyArray<TaskDto>,
  rootId: number,
  includeDescendants: boolean,
): Set<number> {
  const byParent = new Map<number | null, TaskDto[]>();
  for (const t of tasks) {
    const key = t.parent_task_id;
    const arr = byParent.get(key) ?? [];
    arr.push(t);
    byParent.set(key, arr);
  }
  const result = new Set<number>([rootId]);
  if (!includeDescendants) {
    for (const child of byParent.get(rootId) ?? []) result.add(child.task_id);
    return result;
  }
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of byParent.get(current) ?? []) {
      if (!result.has(child.task_id)) {
        result.add(child.task_id);
        stack.push(child.task_id);
      }
    }
  }
  return result;
}
