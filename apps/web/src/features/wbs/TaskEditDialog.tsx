import { useEffect, useMemo, useState } from 'react';
import type { TaskDto } from '@wbs-tool/shared';
import { Button } from '../../components/Button.js';
import { FormField, Input, Textarea } from '../../components/FormField.js';
import { Modal } from '../../components/Modal.js';
import { ApiError, tasksApi } from '../../api/index.js';
import { pushErrorToast, useToastStore } from '../../store/toast-store.js';
import { validateProgress, validateTaskName, validateTaskPeriod } from '../../utils/validation.js';
import { todayLocalIso } from '../../utils/date.js';

interface Props {
  open: boolean;
  projectId: number;
  /** 編集対象。null = 新規。 */
  editing: TaskDto | null;
  /** 新規モード時のデフォルト親 ID（[子タスクを追加] で指定）。 */
  defaultParentTaskId?: number | null;
  /** 親子判定用に同プロジェクトの全タスク。 */
  allTasks: readonly TaskDto[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface FormState {
  name: string;
  assignee: string;
  startDate: string;
  dueDate: string;
  progress: number;
  parentTaskId: number | null;
  description: string;
}

const empty = (): FormState => ({
  name: '',
  assignee: '',
  startDate: todayLocalIso(),
  dueDate: todayLocalIso(),
  progress: 0,
  parentTaskId: null,
  description: '',
});

/**
 * UI-004 タスク編集ダイアログ。
 * - 子を持つ親タスクの場合 start_date / due_date / progress は読み取り専用化（VR-010）
 * - 親変更による循環は事前抑止（VR-004。完全な判定はサーバに任せる）
 */
export function TaskEditDialog({
  open,
  projectId: _projectId,
  editing,
  defaultParentTaskId,
  allTasks,
  onClose,
  onSaved,
}: Props): JSX.Element {
  const [state, setState] = useState<FormState>(empty());
  const [errors, setErrors] = useState<{ [field: string]: string | undefined }>({});
  const [submitting, setSubmitting] = useState(false);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setState({
        name: editing.name,
        assignee: editing.assignee,
        startDate: editing.start_date,
        dueDate: editing.due_date,
        progress: editing.progress,
        parentTaskId: editing.parent_task_id,
        description: editing.description,
      });
    } else {
      setState({ ...empty(), parentTaskId: defaultParentTaskId ?? null });
    }
    setErrors({});
  }, [open, editing, defaultParentTaskId]);

  // 子を持つかは「自身を parent_task_id として参照する他タスクがあるか」で判定
  const hasChildren = useMemo(() => {
    if (!editing) return false;
    return allTasks.some((t) => t.parent_task_id === editing.task_id);
  }, [allTasks, editing]);

  const readOnlyDerived = hasChildren;

  // 親候補: 自分自身と自分の子孫を除外（VR-004 簡易事前判定）
  const parentCandidates = useMemo(() => {
    if (!editing) return allTasks;
    const excluded = new Set<number>([editing.task_id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of allTasks) {
        if (
          t.parent_task_id !== null &&
          excluded.has(t.parent_task_id) &&
          !excluded.has(t.task_id)
        ) {
          excluded.add(t.task_id);
          changed = true;
        }
      }
    }
    return allTasks.filter((t) => !excluded.has(t.task_id));
  }, [allTasks, editing]);

  const validate = (s: FormState): { [field: string]: string } => {
    const e: { [field: string]: string } = {};
    const v1 = validateTaskName(s.name);
    if (v1) e.name = v1.message;
    const v2 = validateTaskPeriod(s.startDate, s.dueDate);
    if (v2) e.dueDate = v2.message;
    const v3 = validateProgress(s.progress);
    if (v3) e.progress = v3.message;
    return e;
  };

  const onSubmit = async (): Promise<void> => {
    const fieldErrors = validate(state);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await tasksApi.update(editing.task_id, {
          name: state.name,
          assignee: state.assignee,
          start_date: state.startDate,
          due_date: state.dueDate,
          progress: state.progress,
          parent_task_id: state.parentTaskId,
          description: state.description,
        });
        pushToast({ kind: 'success', message: 'タスクを更新しました' });
      } else {
        await tasksApi.create(_projectId, {
          name: state.name,
          assignee: state.assignee,
          start_date: state.startDate,
          due_date: state.dueDate,
          progress: state.progress,
          parent_task_id: state.parentTaskId,
          description: state.description,
        });
        pushToast({ kind: 'success', message: 'タスクを作成しました' });
      }
      await onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        setErrors({ [err.field]: err.message });
      } else {
        pushErrorToast(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? 'タスクを編集' : 'タスクを追加'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={submitting}>
            保存
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {readOnlyDerived ? (
          <p
            style={{
              margin: 0,
              padding: 'var(--space-3)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-sunken)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            このタスクは子タスクを持つため、開始日・期限・進捗は子タスクから自動算出されます（読み取り専用）。
          </p>
        ) : null}

        <FormField label="タスク名" required error={errors.name}>
          <Input
            type="text"
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            invalid={errors.name !== undefined}
            autoFocus
          />
        </FormField>

        <FormField label="担当者">
          <Input
            type="text"
            value={state.assignee}
            onChange={(e) => setState({ ...state, assignee: e.target.value })}
          />
        </FormField>

        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <FormField label="開始日" required>
            <Input
              type="date"
              value={state.startDate}
              onChange={(e) => setState({ ...state, startDate: e.target.value })}
              disabled={readOnlyDerived}
            />
          </FormField>
          <FormField label="期限" required error={errors.dueDate}>
            <Input
              type="date"
              value={state.dueDate}
              onChange={(e) => setState({ ...state, dueDate: e.target.value })}
              invalid={errors.dueDate !== undefined}
              disabled={readOnlyDerived}
            />
          </FormField>
        </div>

        <FormField label="進捗 (%)" error={errors.progress}>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={state.progress}
            onChange={(e) =>
              setState({ ...state, progress: Number.parseInt(e.target.value, 10) || 0 })
            }
            invalid={errors.progress !== undefined}
            disabled={readOnlyDerived}
          />
        </FormField>

        <FormField
          label="親タスク"
          hint={parentCandidates.length === 0 ? '候補がありません' : undefined}
        >
          <select
            value={state.parentTaskId ?? ''}
            onChange={(e) =>
              setState({
                ...state,
                parentTaskId: e.target.value === '' ? null : Number.parseInt(e.target.value, 10),
              })
            }
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-surface)',
            }}
          >
            <option value="">（最上位）</option>
            {parentCandidates.map((t) => (
              <option key={t.task_id} value={t.task_id}>
                {t.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="説明">
          <Textarea
            value={state.description}
            onChange={(e) => setState({ ...state, description: e.target.value })}
            rows={3}
          />
        </FormField>
      </div>
    </Modal>
  );
}
