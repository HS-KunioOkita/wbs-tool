import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Loading } from '../../components/Loading.js';
import { ApiError, tasksApi } from '../../api/index.js';
import { useProjectStore } from '../../store/project-store.js';
import { pushErrorToast, useToastStore } from '../../store/toast-store.js';
import { TaskEditDialog } from './TaskEditDialog.js';
import { TaskTree } from './TaskTree.js';
import styles from './WbsMainPage.module.css';

/**
 * UI-003 WBS メイン画面 — フェーズ 3 範囲では「ツールバー + 左ペイン（タスクツリー）+
 * 右ペイン（プレースホルダ）」の骨格まで実装する。SVG ガント / 依存線 /
 * ドラッグ&ドロップ / フィルタ / PDF は T-053〜T-063（フェーズ 4 以降）。
 */
export function WbsMainPage(): JSX.Element {
  const params = useParams();
  const projectId = Number.parseInt(params.projectId ?? '', 10);
  const navigate = useNavigate();
  const { currentProject, tasks, isLoading, open, close, reloadTasks } = useProjectStore();
  const pushToast = useToastStore((s) => s.push);

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [defaultParent, setDefaultParent] = useState<number | null>(null);

  useEffect(() => {
    if (Number.isNaN(projectId)) {
      navigate('/');
      return;
    }
    void (async () => {
      try {
        await open(projectId);
      } catch (err) {
        if (err instanceof ApiError) pushErrorToast(err);
        navigate('/');
      }
    })();
    return () => close();
  }, [projectId, open, close, navigate]);

  const editing = editingTaskId !== null ? tasks.find((t) => t.task_id === editingTaskId) : null;
  const selected = selectedTaskId !== null ? tasks.find((t) => t.task_id === selectedTaskId) : null;

  const onDelete = useCallback(async () => {
    if (!selected) return;
    if (!window.confirm(`タスク「${selected.name}」を削除します。よろしいですか？`)) return;
    try {
      const res = await tasksApi.remove(selected.task_id);
      pushToast({
        kind: 'success',
        message: `タスクを削除しました（昇格 ${res.promoted_child_task_ids.length} 件 / 依存削除 ${res.deleted_dependency_ids.length} 件）`,
      });
      setSelectedTaskId(null);
      await reloadTasks();
    } catch (err) {
      pushErrorToast(err);
    }
  }, [selected, pushToast, reloadTasks]);

  if (isLoading || !currentProject) {
    return (
      <div className={styles.page}>
        <Loading label="プロジェクトを読み込み中…" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.appName}>WBS 管理ツール</span>
          <span className={styles.separator}>/</span>
          <span className={styles.projectName}>{currentProject.name}</span>
        </div>
        <Button variant="secondary" onClick={() => navigate('/')}>
          プロジェクト切替
        </Button>
      </header>

      <div className={styles.toolbar} role="toolbar" aria-label="WBS 操作">
        <Button
          variant="primary"
          onClick={() => {
            setEditingTaskId(null);
            setDefaultParent(null);
            setShowEdit(true);
          }}
        >
          ＋ タスク追加
        </Button>
        <Button
          variant="secondary"
          disabled={!selected}
          onClick={() => {
            setEditingTaskId(null);
            setDefaultParent(selected!.task_id);
            setShowEdit(true);
          }}
        >
          ＋ 子タスク
        </Button>
        <Button
          variant="secondary"
          disabled={!selected}
          onClick={() => {
            setEditingTaskId(selected!.task_id);
            setDefaultParent(null);
            setShowEdit(true);
          }}
        >
          編集
        </Button>
        <Button variant="danger" disabled={!selected} onClick={() => void onDelete()}>
          削除
        </Button>
        <span className={styles.spacer} />
        <span className={styles.taskCount}>表示中: {tasks.length} 件</span>
      </div>

      <main className={styles.body}>
        <div className={styles.left}>
          {tasks.length === 0 ? (
            <EmptyState
              title="タスクがまだありません"
              description="ツールバーの「＋ タスク追加」から最初のタスクを作成してください。"
            />
          ) : (
            <TaskTree tasks={tasks} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} />
          )}
        </div>
        <div className={styles.right} role="region" aria-label="ガントチャート">
          <EmptyState
            title="ガントチャートは次フェーズで実装します"
            description="現在はタスクツリーのみ機能します（T-053〜063 の作業）。"
          />
        </div>
      </main>

      <TaskEditDialog
        open={showEdit}
        projectId={projectId}
        editing={editing ?? null}
        defaultParentTaskId={defaultParent}
        allTasks={tasks}
        onClose={() => setShowEdit(false)}
        onSaved={() => reloadTasks()}
      />
    </div>
  );
}
