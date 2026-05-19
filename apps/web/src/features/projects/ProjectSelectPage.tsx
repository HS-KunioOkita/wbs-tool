import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectDto } from '@wbs-tool/shared';
import { ApiError, projectsApi } from '../../api/index.js';
import { Button } from '../../components/Button.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Loading } from '../../components/Loading.js';
import { pushErrorToast } from '../../store/toast-store.js';
import { formatDate } from '../../utils/date.js';
import { ProjectEditDialog } from './ProjectEditDialog.js';
import { DeleteProjectDialog } from './DeleteProjectDialog.js';
import styles from './ProjectSelectPage.module.css';

/**
 * UI-001 プロジェクト選択画面。
 * 設計: interface-design.md §3.1 UI-001 / screen/UI-001-project-select/。
 */
export function ProjectSelectPage(): JSX.Element {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ProjectDto | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState<ProjectDto | null>(null);
  const navigate = useNavigate();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectsApi.list();
      setProjects(res.projects);
    } catch (err) {
      if (err instanceof ApiError) pushErrorToast(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = projects.find((p) => p.project_id === selectedId) ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>WBS 管理ツール</h1>
      </header>

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setShowEdit(true);
            }}
          >
            ＋ 新規作成
          </Button>
          <Button
            variant="secondary"
            disabled={!selected}
            onClick={() => {
              setEditing(selected);
              setShowEdit(true);
            }}
          >
            編集
          </Button>
          <Button variant="danger" disabled={!selected} onClick={() => setDeleting(selected)}>
            削除
          </Button>
          <Button
            variant="primary"
            disabled={!selected}
            onClick={() => navigate(`/projects/${selected!.project_id}`)}
            style={{ marginLeft: 'auto' }}
          >
            開く →
          </Button>
        </div>

        {loading ? (
          <Loading label="プロジェクト一覧を読み込み中…" />
        ) : projects.length === 0 ? (
          <EmptyState
            title="プロジェクトがまだありません"
            description="「＋ 新規作成」から最初のプロジェクトを作成してください。"
          />
        ) : (
          <ul className={styles.list} role="listbox" aria-label="プロジェクト一覧">
            {projects.map((p) => (
              <li
                key={p.project_id}
                role="option"
                aria-selected={p.project_id === selectedId}
                tabIndex={0}
                className={`${styles.row} ${p.project_id === selectedId ? styles.selected : ''}`}
                onClick={() => setSelectedId(p.project_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(p.project_id);
                  }
                }}
                onDoubleClick={() => navigate(`/projects/${p.project_id}`)}
              >
                <div className={styles.name}>{p.name}</div>
                {p.description ? <div className={styles.description}>{p.description}</div> : null}
                <div className={styles.meta}>作成日: {formatDate(p.created_at.slice(0, 10))}</div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ProjectEditDialog
        open={showEdit}
        editing={editing}
        onClose={() => setShowEdit(false)}
        onSaved={reload}
      />
      <DeleteProjectDialog
        open={deleting !== null}
        project={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setSelectedId(null);
          void reload();
        }}
      />
    </div>
  );
}
