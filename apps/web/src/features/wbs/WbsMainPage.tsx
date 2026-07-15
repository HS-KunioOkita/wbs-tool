import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Loading } from '../../components/Loading.js';
import { ApiError, tasksApi } from '../../api/index.js';
import { useProjectStore } from '../../store/project-store.js';
import { pushErrorToast, useToastStore } from '../../store/toast-store.js';
import { DependencyEditDialog } from './DependencyEditDialog.js';
import { TaskEditDialog } from './TaskEditDialog.js';
import { TaskTree } from './TaskTree.js';
import { GanttChart } from './gantt/GanttChart.js';
import type { Granularity } from './gantt/coordinates.js';
import { FilterPanel } from './FilterPanel.js';
import { PdfExportDialog } from './PdfExportDialog.js';
import { applyFilter, emptyFilter, isFilterActive, type TaskFilter } from './filter.js';
import styles from './WbsMainPage.module.css';

/**
 * UI-003 WBS メイン画面（完全版）。
 * - 左ペイン: タスクツリー
 * - 右ペイン: ガントチャート
 * - ツールバー: タスク CRUD / 粒度 / 依存線 ON-OFF / フィルタ / PDF
 * - 依存関係編集ダイアログ / PDF エクスポート設定ダイアログ
 */
export function WbsMainPage(): JSX.Element {
  const params = useParams();
  const projectId = Number.parseInt(params.projectId ?? '', 10);
  const navigate = useNavigate();
  const {
    currentProject,
    tasks,
    dependencies,
    isLoading,
    open,
    close,
    reloadTasks,
    reloadDependencies,
  } = useProjectStore();
  const pushToast = useToastStore((s) => s.push);

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [defaultParent, setDefaultParent] = useState<number | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [showDependencies, setShowDependencies] = useState(true);
  const [filter, setFilter] = useState<TaskFilter>(emptyFilter);
  const [showFilter, setShowFilter] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showDependencyEdit, setShowDependencyEdit] = useState(false);

  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncLock = useRef(false);

  // 左ペイン（タスクツリー）と右ペイン（ガント）の縦スクロールを同期し、行とバーの
  // 縦位置を常に一致させる。両者は行高さを揃えてあるため scrollTop の一致で整列する。
  const syncScroll = useCallback((source: 'tree' | 'gantt') => {
    if (scrollSyncLock.current) return;
    const tree = treeScrollRef.current;
    const gantt = ganttContainerRef.current;
    if (!tree || !gantt) return;
    scrollSyncLock.current = true;
    if (source === 'tree') gantt.scrollTop = tree.scrollTop;
    else tree.scrollTop = gantt.scrollTop;
    requestAnimationFrame(() => {
      scrollSyncLock.current = false;
    });
  }, []);

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

  const visibleTasks = useMemo(() => applyFilter(tasks, filter), [tasks, filter]);
  const filterActive = isFilterActive(filter);

  const editing = editingTaskId !== null ? tasks.find((t) => t.task_id === editingTaskId) : null;
  const selected =
    selectedTaskId !== null ? (tasks.find((t) => t.task_id === selectedTaskId) ?? null) : null;

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
      await Promise.all([reloadTasks(), reloadDependencies()]);
    } catch (err) {
      pushErrorToast(err);
    }
  }, [selected, pushToast, reloadTasks, reloadDependencies]);

  const getGanttSvg = useCallback(
    (): SVGSVGElement | null => ganttContainerRef.current?.querySelector('svg') ?? null,
    [],
  );

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
        <Button
          variant="secondary"
          disabled={!selected}
          onClick={() => setShowDependencyEdit(true)}
        >
          依存関係
        </Button>

        <span className={styles.divider} aria-hidden="true" />

        <span className={styles.controlLabel}>粒度</span>
        <div role="group" aria-label="表示粒度">
          <Button
            size="sm"
            variant={granularity === 'day' ? 'primary' : 'secondary'}
            onClick={() => setGranularity('day')}
          >
            日
          </Button>
          <Button
            size="sm"
            variant={granularity === 'month' ? 'primary' : 'secondary'}
            onClick={() => setGranularity('month')}
          >
            月
          </Button>
        </div>

        <span className={styles.divider} aria-hidden="true" />

        <label className={styles.switchRow}>
          <input
            type="checkbox"
            checked={showDependencies}
            onChange={(e) => setShowDependencies(e.target.checked)}
          />
          依存線
        </label>

        <span className={styles.divider} aria-hidden="true" />

        <Button
          variant={filterActive ? 'primary' : 'secondary'}
          onClick={() => setShowFilter(true)}
        >
          フィルタ{filterActive ? ' ●' : ''}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowPdf(true)}
          disabled={visibleTasks.length === 0}
        >
          PDF
        </Button>

        <span className={styles.spacer} />
        <span className={styles.taskCount}>
          表示中 {visibleTasks.length} / {tasks.length} 件 / 依存 {dependencies.length} 件
          {filterActive ? <span className={styles.filterBadge}>フィルタ適用中</span> : null}
        </span>
      </div>

      <main className={styles.body}>
        <div className={styles.left}>
          {tasks.length === 0 ? (
            <EmptyState
              title="タスクがまだありません"
              description="ツールバーの「＋ タスク追加」から最初のタスクを作成してください。"
            />
          ) : visibleTasks.length === 0 ? (
            <EmptyState
              title="条件に合致するタスクがありません"
              description="フィルタをクリアしてください。"
              action={
                <Button variant="secondary" onClick={() => setFilter(emptyFilter)}>
                  フィルタをクリア
                </Button>
              }
            />
          ) : (
            <TaskTree
              tasks={visibleTasks}
              selectedTaskId={selectedTaskId}
              onSelect={setSelectedTaskId}
              scrollRef={treeScrollRef}
              onScroll={() => syncScroll('tree')}
            />
          )}
        </div>
        <div
          className={styles.right}
          role="region"
          aria-label="ガントチャート"
          ref={ganttContainerRef}
          onScroll={() => syncScroll('gantt')}
        >
          {visibleTasks.length === 0 ? (
            <EmptyState title="表示対象のタスクがありません" />
          ) : (
            <GanttChart
              tasks={visibleTasks}
              dependencies={dependencies}
              granularity={granularity}
              showDependencies={showDependencies}
              selectedTaskId={selectedTaskId}
              onSelect={setSelectedTaskId}
              onTaskUpdated={() => reloadTasks()}
            />
          )}
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
      <DependencyEditDialog
        open={showDependencyEdit && selected !== null}
        projectId={projectId}
        targetTask={selected}
        allTasks={tasks}
        dependencies={dependencies}
        onClose={() => setShowDependencyEdit(false)}
        onChanged={() => reloadDependencies()}
      />
      <FilterPanel
        open={showFilter}
        initial={filter}
        allTasks={tasks}
        onClose={() => setShowFilter(false)}
        onApply={(f) => setFilter(f)}
        onClear={() => setFilter(emptyFilter)}
      />
      <PdfExportDialog
        open={showPdf}
        projectName={currentProject.name}
        tasks={visibleTasks}
        dependencies={dependencies}
        showDependencies={showDependencies}
        getGanttSvg={getGanttSvg}
        onClose={() => setShowPdf(false)}
      />
    </div>
  );
}
