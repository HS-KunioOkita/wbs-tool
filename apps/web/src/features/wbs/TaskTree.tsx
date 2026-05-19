import { useMemo, useState } from 'react';
import type { TaskDto } from '@wbs-tool/shared';
import { formatDate, isOverdue } from '../../utils/date.js';
import styles from './TaskTree.module.css';

interface Props {
  tasks: readonly TaskDto[];
  selectedTaskId: number | null;
  onSelect: (taskId: number) => void;
}

interface Node {
  task: TaskDto;
  children: Node[];
  depth: number;
}

/**
 * UI-003 左ペインのタスクツリー。
 * - 親子インデント、展開折りたたみ
 * - 期限超過行は色 + 「⚠」アイコン併用（A11Y-001）
 */
export function TaskTree({ tasks, selectedTaskId, onSelect }: Props): JSX.Element {
  const roots = useMemo(() => buildTree(tasks), [tasks]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggle = (taskId: number): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const flat: Node[] = useMemo(() => {
    const out: Node[] = [];
    const walk = (nodes: Node[]): void => {
      for (const n of nodes) {
        out.push(n);
        if (n.children.length > 0 && !collapsed.has(n.task.task_id)) walk(n.children);
      }
    };
    walk(roots);
    return out;
  }, [roots, collapsed]);

  return (
    <div className={styles.tree} role="tree">
      <div className={styles.headerRow} role="row">
        <span className={styles.colName}>タスク名</span>
        <span className={styles.colAssignee}>担当者</span>
        <span className={styles.colPeriod}>期間</span>
        <span className={styles.colProgress}>進捗</span>
      </div>
      {flat.map((n) => {
        const t = n.task;
        const hasChildren = n.children.length > 0;
        const overdue = isOverdue(t.due_date, t.progress);
        const isCompleted = t.progress >= 100;
        const isSelected = t.task_id === selectedTaskId;
        return (
          <div
            key={t.task_id}
            role="treeitem"
            aria-label={t.name}
            aria-level={n.depth + 1}
            aria-expanded={hasChildren ? !collapsed.has(t.task_id) : undefined}
            aria-selected={isSelected}
            tabIndex={0}
            className={[
              styles.row,
              isSelected ? styles.selected : '',
              overdue ? styles.overdue : '',
              isCompleted ? styles.completed : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(t.task_id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(t.task_id);
              }
            }}
          >
            <span
              className={styles.colName}
              style={{ paddingLeft: `calc(${n.depth} * var(--space-4))` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className={styles.toggle}
                  aria-label={collapsed.has(t.task_id) ? '展開' : '折りたたみ'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(t.task_id);
                  }}
                >
                  {collapsed.has(t.task_id) ? '▶' : '▼'}
                </button>
              ) : (
                <span className={styles.togglePlaceholder} />
              )}
              {overdue ? (
                <span aria-label="期限超過" title="期限超過">
                  ⚠
                </span>
              ) : null}
              {isCompleted ? (
                <span aria-label="完了" title="完了">
                  ✓
                </span>
              ) : null}
              <span className={styles.name}>{t.name}</span>
            </span>
            <span className={styles.colAssignee}>{t.assignee || '−'}</span>
            <span className={styles.colPeriod}>
              {formatDate(t.start_date)} 〜 {formatDate(t.due_date)}
            </span>
            <span className={styles.colProgress}>{t.progress}%</span>
          </div>
        );
      })}
    </div>
  );
}

function buildTree(tasks: readonly TaskDto[]): Node[] {
  const byParent = new Map<number | null, TaskDto[]>();
  for (const t of tasks) {
    const key = t.parent_task_id;
    const arr = byParent.get(key) ?? [];
    arr.push(t);
    byParent.set(key, arr);
  }
  const make = (parent: number | null, depth: number): Node[] =>
    (byParent.get(parent) ?? [])
      .slice()
      .sort((a, b) => a.task_id - b.task_id)
      .map((t) => ({ task: t, depth, children: make(t.task_id, depth + 1) }));
  return make(null, 0);
}
