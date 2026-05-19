import { useMemo, useState } from 'react';
import type { DependencyDto, TaskDto } from '@wbs-tool/shared';
import { ApiError, dependenciesApi } from '../../api/index.js';
import { Button } from '../../components/Button.js';
import { Modal } from '../../components/Modal.js';
import { pushErrorToast, useToastStore } from '../../store/toast-store.js';
import styles from './DependencyEditDialog.module.css';

interface Props {
  open: boolean;
  projectId: number;
  /** 基準となるタスク（このタスクが先行 / 後続となる関係を表示・編集）。 */
  targetTask: TaskDto | null;
  /** プロジェクト配下の全タスク（追加先の選択肢用）。 */
  allTasks: ReadonlyArray<TaskDto>;
  /** プロジェクト配下の全依存関係（フィルタ表示用）。 */
  dependencies: ReadonlyArray<DependencyDto>;
  onClose: () => void;
  /** 追加・削除のたびに呼び出される。呼出側で再ロード。 */
  onChanged: () => Promise<void> | void;
}

/**
 * UI-005 依存関係編集ダイアログ。
 * - 対象タスクが先行となる関係（targetTask → 後続）と、後続となる関係（先行 → targetTask）を一覧
 * - 追加: 相手タスク選択 + 方向（先行 / 後続）→ 即時 API-012
 * - 削除: 行ごとの削除ボタン → 即時 API-013
 * - VR-005/6/7/8 エラーはトーストで提示
 */
export function DependencyEditDialog({
  open,
  projectId,
  targetTask,
  allTasks,
  dependencies,
  onClose,
  onChanged,
}: Props): JSX.Element | null {
  const [direction, setDirection] = useState<'as-predecessor' | 'as-successor'>('as-predecessor');
  const [counterpartId, setCounterpartId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const pushToast = useToastStore((s) => s.push);

  const taskMap = useMemo(() => {
    const m = new Map<number, TaskDto>();
    for (const t of allTasks) m.set(t.task_id, t);
    return m;
  }, [allTasks]);

  // 対象が先行となる関係（targetTask → 後続）
  const outgoing = useMemo(
    () =>
      targetTask === null
        ? []
        : dependencies.filter((d) => d.predecessor_task_id === targetTask.task_id),
    [dependencies, targetTask],
  );

  // 対象が後続となる関係（先行 → targetTask）
  const incoming = useMemo(
    () =>
      targetTask === null
        ? []
        : dependencies.filter((d) => d.successor_task_id === targetTask.task_id),
    [dependencies, targetTask],
  );

  // 追加対象の候補（自分以外のタスク）
  const counterpartCandidates = useMemo(
    () => (targetTask === null ? [] : allTasks.filter((t) => t.task_id !== targetTask.task_id)),
    [allTasks, targetTask],
  );

  if (!targetTask) return null;

  const onAdd = async (): Promise<void> => {
    if (counterpartId === '') return;
    const predecessor =
      direction === 'as-predecessor' ? targetTask.task_id : (counterpartId as number);
    const successor =
      direction === 'as-predecessor' ? (counterpartId as number) : targetTask.task_id;

    setSubmitting(true);
    try {
      await dependenciesApi.create(projectId, {
        predecessor_task_id: predecessor,
        successor_task_id: successor,
      });
      pushToast({ kind: 'success', message: '依存関係を追加しました' });
      setCounterpartId('');
      await onChanged();
    } catch (err) {
      if (err instanceof ApiError) pushErrorToast(err);
      else pushErrorToast(err);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (dependencyId: number): Promise<void> => {
    setSubmitting(true);
    try {
      await dependenciesApi.remove(dependencyId);
      pushToast({ kind: 'success', message: '依存関係を削除しました' });
      await onChanged();
    } catch (err) {
      pushErrorToast(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`依存関係を編集 — ${targetTask.name}`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <div className={styles.layout}>
        <section className={styles.section}>
          <h3 className={styles.heading}>追加</h3>
          <div className={styles.addRow}>
            <select
              value={direction}
              onChange={(e) =>
                setDirection(
                  e.target.value === 'as-predecessor' ? 'as-predecessor' : 'as-successor',
                )
              }
              className={styles.select}
            >
              <option value="as-predecessor">このタスク → 後続</option>
              <option value="as-successor">先行 → このタスク</option>
            </select>
            <select
              value={counterpartId}
              onChange={(e) =>
                setCounterpartId(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))
              }
              className={styles.select}
            >
              <option value="">相手タスクを選択…</option>
              {counterpartCandidates.map((t) => (
                <option key={t.task_id} value={t.task_id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              size="sm"
              disabled={counterpartId === '' || submitting}
              onClick={() => void onAdd()}
            >
              追加
            </Button>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>先行関係（このタスク → 後続）</h3>
          {outgoing.length === 0 ? (
            <p className={styles.empty}>先行関係はありません</p>
          ) : (
            <ul className={styles.list}>
              {outgoing.map((d) => {
                const counterpart = taskMap.get(d.successor_task_id);
                return (
                  <li key={d.dependency_id} className={styles.row}>
                    <span className={styles.arrow}>→</span>
                    <span className={styles.taskName}>
                      {counterpart?.name ?? `#${d.successor_task_id}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={submitting}
                      onClick={() => void onDelete(d.dependency_id)}
                    >
                      削除
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.heading}>後続関係（先行 → このタスク）</h3>
          {incoming.length === 0 ? (
            <p className={styles.empty}>後続関係はありません</p>
          ) : (
            <ul className={styles.list}>
              {incoming.map((d) => {
                const counterpart = taskMap.get(d.predecessor_task_id);
                return (
                  <li key={d.dependency_id} className={styles.row}>
                    <span className={styles.arrow}>←</span>
                    <span className={styles.taskName}>
                      {counterpart?.name ?? `#${d.predecessor_task_id}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={submitting}
                      onClick={() => void onDelete(d.dependency_id)}
                    >
                      削除
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
