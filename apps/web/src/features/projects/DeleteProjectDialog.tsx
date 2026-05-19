import { useState } from 'react';
import type { ProjectDto } from '@wbs-tool/shared';
import { Button } from '../../components/Button.js';
import { Modal } from '../../components/Modal.js';
import { ApiError, projectsApi, tasksApi, dependenciesApi } from '../../api/index.js';
import { pushErrorToast, useToastStore } from '../../store/toast-store.js';

interface Props {
  open: boolean;
  project: ProjectDto | null;
  onClose: () => void;
  onDeleted: () => void;
}

interface ImpactCounts {
  tasks: number;
  dependencies: number;
}

/**
 * UI-001 の削除ボタン押下時に表示される確認ダイアログ。
 * 連鎖削除件数を提示する（インタフェース設計 RISK-006）。
 */
export function DeleteProjectDialog({ open, project, onClose, onDeleted }: Props): JSX.Element {
  const [impact, setImpact] = useState<ImpactCounts | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pushToast = useToastStore((s) => s.push);

  // open になった瞬間に影響件数を取得
  if (open && project && impact === null && !submitting) {
    void (async () => {
      try {
        const [tasksRes, depsRes] = await Promise.all([
          tasksApi.listByProject(project.project_id),
          dependenciesApi.listByProject(project.project_id),
        ]);
        setImpact({ tasks: tasksRes.tasks.length, dependencies: depsRes.dependencies.length });
      } catch (err) {
        if (err instanceof ApiError) pushErrorToast(err);
      }
    })();
  }

  const handleClose = (): void => {
    setImpact(null);
    onClose();
  };

  const onConfirm = async (): Promise<void> => {
    if (!project) return;
    setSubmitting(true);
    try {
      await projectsApi.remove(project.project_id);
      pushToast({
        kind: 'success',
        message: `プロジェクト「${project.name}」を削除しました`,
      });
      onDeleted();
      handleClose();
    } catch (err) {
      pushErrorToast(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="プロジェクトの削除"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={submitting || impact === null}>
            削除する
          </Button>
        </>
      }
    >
      <p>
        プロジェクト「<strong>{project?.name}</strong>」を削除します。
      </p>
      {impact ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>
          配下のタスク <strong>{impact.tasks}</strong> 件、依存関係{' '}
          <strong>{impact.dependencies}</strong> 件もすべて削除されます。この操作は取り消せません。
        </p>
      ) : (
        <p style={{ color: 'var(--color-text-tertiary)' }}>影響件数を確認中…</p>
      )}
    </Modal>
  );
}
