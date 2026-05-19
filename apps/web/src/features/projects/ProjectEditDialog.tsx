import { useEffect, useState } from 'react';
import type { ProjectDto } from '@wbs-tool/shared';
import { Button } from '../../components/Button.js';
import { FormField, Input, Textarea } from '../../components/FormField.js';
import { Modal } from '../../components/Modal.js';
import { ApiError, projectsApi } from '../../api/index.js';
import { pushErrorToast, useToastStore } from '../../store/toast-store.js';
import { validateProjectName } from '../../utils/validation.js';

interface Props {
  open: boolean;
  /** 編集対象。null = 新規モード。 */
  editing: ProjectDto | null;
  onClose: () => void;
  /** 保存成功時のコールバック。呼び出し側で一覧再取得などを行う。 */
  onSaved: () => void;
}

/**
 * UI-002 プロジェクト編集ダイアログ（新規 / 編集）。
 * 設計: interface-design.md §3.1 UI-002 / screen/UI-002-project-edit-dialog/。
 */
export function ProjectEditDialog({ open, editing, onClose, onSaved }: Props): JSX.Element {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pushToast = useToastStore((s) => s.push);

  // 開くたびに値をリセット
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setError(null);
  }, [open, editing]);

  const onSubmit = async (): Promise<void> => {
    const v = validateProjectName(name);
    if (v) {
      setError(v.message);
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await projectsApi.update(editing.project_id, { name, description });
        pushToast({ kind: 'success', message: 'プロジェクトを更新しました' });
      } else {
        await projectsApi.create({ name, description });
        pushToast({ kind: 'success', message: 'プロジェクトを作成しました' });
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ERR-001') {
        setError(err.message);
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
      title={editing ? 'プロジェクトを編集' : 'プロジェクトを新規作成'}
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
        <FormField label="プロジェクト名" required error={error ?? undefined}>
          <Input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            invalid={error !== null}
            autoFocus
          />
        </FormField>
        <FormField label="説明">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </FormField>
        {editing ? (
          <FormField label="作成日">
            <Input type="text" value={editing.created_at} disabled />
          </FormField>
        ) : null}
      </div>
    </Modal>
  );
}
