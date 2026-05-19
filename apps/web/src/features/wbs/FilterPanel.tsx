import { useEffect, useState } from 'react';
import type { TaskDto } from '@wbs-tool/shared';
import { Button } from '../../components/Button.js';
import { FormField, Input } from '../../components/FormField.js';
import { Modal } from '../../components/Modal.js';
import { validateFilterRange } from '../../utils/validation.js';
import { emptyFilter, type TaskFilter } from './filter.js';
import styles from './FilterPanel.module.css';

interface Props {
  open: boolean;
  initial: TaskFilter;
  allTasks: ReadonlyArray<TaskDto>;
  onClose: () => void;
  onApply: (filter: TaskFilter) => void;
  onClear: () => void;
}

/**
 * UI-006 フィルタパネル（モーダル形式）。
 * - 担当者部分一致（OPEN-05）、開始日範囲、期限範囲、親タスク
 * - VR-011 から ≤ to を事前検証し、違反時は適用不可
 */
export function FilterPanel({
  open,
  initial,
  allTasks,
  onClose,
  onApply,
  onClear,
}: Props): JSX.Element | null {
  const [draft, setDraft] = useState<TaskFilter>(initial);
  const [errors, setErrors] = useState<{ [field: string]: string | undefined }>({});

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setErrors({});
    }
  }, [open, initial]);

  if (!open) return null;

  const validate = (f: TaskFilter): { [field: string]: string } => {
    const e: { [field: string]: string } = {};
    const v1 = validateFilterRange(f.startFrom, f.startTo);
    if (v1) e.startTo = v1.message;
    const v2 = validateFilterRange(f.dueFrom, f.dueTo);
    if (v2) e.dueTo = v2.message;
    return e;
  };

  const onSubmit = (): void => {
    const fe = validate(draft);
    if (Object.keys(fe).length > 0) {
      setErrors(fe);
      return;
    }
    onApply(draft);
    onClose();
  };

  const onResetAndClose = (): void => {
    onClear();
    onClose();
  };

  return (
    <Modal
      open={open}
      title="フィルタ"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onResetAndClose}>
            クリア
          </Button>
          <Button variant="primary" onClick={onSubmit}>
            適用
          </Button>
        </>
      }
    >
      <div className={styles.layout}>
        <FormField label="担当者（部分一致）" hint="例: 山田">
          <Input
            type="text"
            value={draft.assignee}
            onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
          />
        </FormField>

        <div className={styles.dateGrid}>
          <FormField label="開始日 from">
            <Input
              type="date"
              value={draft.startFrom ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, startFrom: e.target.value === '' ? null : e.target.value })
              }
            />
          </FormField>
          <FormField label="開始日 to" error={errors.startTo}>
            <Input
              type="date"
              value={draft.startTo ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, startTo: e.target.value === '' ? null : e.target.value })
              }
              invalid={errors.startTo !== undefined}
            />
          </FormField>
        </div>

        <div className={styles.dateGrid}>
          <FormField label="期限 from">
            <Input
              type="date"
              value={draft.dueFrom ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, dueFrom: e.target.value === '' ? null : e.target.value })
              }
            />
          </FormField>
          <FormField label="期限 to" error={errors.dueTo}>
            <Input
              type="date"
              value={draft.dueTo ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, dueTo: e.target.value === '' ? null : e.target.value })
              }
              invalid={errors.dueTo !== undefined}
            />
          </FormField>
        </div>

        <FormField label="親タスク（指定タスク配下のみ）">
          <select
            value={draft.parentTaskId ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                parentTaskId: e.target.value === '' ? null : Number.parseInt(e.target.value, 10),
              })
            }
            className={styles.select}
          >
            <option value="">指定しない</option>
            {allTasks.map((t) => (
              <option key={t.task_id} value={t.task_id}>
                {t.name}
              </option>
            ))}
          </select>
        </FormField>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={draft.includeDescendants}
            onChange={(e) => setDraft({ ...draft, includeDescendants: e.target.checked })}
          />
          子孫タスクも含む
        </label>
      </div>
    </Modal>
  );
}

export function emptyTaskFilter(): TaskFilter {
  return emptyFilter;
}
