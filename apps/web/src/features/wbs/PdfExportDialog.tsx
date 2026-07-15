import { useState } from 'react';
import type { DependencyDto, TaskDto } from '@wbs-tool/shared';
import { Button } from '../../components/Button.js';
import { Modal } from '../../components/Modal.js';
import { pushErrorToast, useToastStore } from '../../store/toast-store.js';
import { exportPdf, type ExportKind } from './pdf.js';
import styles from './PdfExportDialog.module.css';

interface Props {
  open: boolean;
  projectName: string;
  tasks: ReadonlyArray<TaskDto>;
  /** 「両方」出力時の依存線描画に使用する（表示中の依存関係）。 */
  dependencies: ReadonlyArray<DependencyDto>;
  /** UI-003 の依存線表示トグルの状態。 */
  showDependencies: boolean;
  /** ガント SVG の参照取得関数。UI-003 が描画中なら要素を返し、非表示なら null。 */
  getGanttSvg: () => SVGSVGElement | null;
  onClose: () => void;
}

/**
 * UI-007 PDF エクスポート設定。
 * - 対象（タスク一覧 / ガントチャート / 両方）の選択
 * - 対象タスク 0 件で出力ボタンを抑止（ERR-004）
 */
export function PdfExportDialog({
  open,
  projectName,
  tasks,
  dependencies,
  showDependencies,
  getGanttSvg,
  onClose,
}: Props): JSX.Element | null {
  const [kind, setKind] = useState<ExportKind>('both');
  const [submitting, setSubmitting] = useState(false);
  const pushToast = useToastStore((s) => s.push);

  if (!open) return null;

  const targetCount = tasks.length;
  const disabledNoTasks = targetCount === 0;

  const onExport = async (): Promise<void> => {
    setSubmitting(true);
    try {
      const { filename } = await exportPdf({
        projectName,
        kind,
        tasks,
        dependencies,
        showDependencies,
        // 「両方」は SVG を使わず jsPDF が直接描画するため、SVG が必要なのは「ガントチャートのみ」だけ
        ganttSvg: kind === 'gantt' ? getGanttSvg() : null,
      });
      pushToast({ kind: 'success', message: `PDF を出力しました: ${filename}` });
      onClose();
    } catch (err) {
      pushErrorToast(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="PDF エクスポート"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={() => void onExport()}
            disabled={disabledNoTasks || submitting}
          >
            {submitting ? '出力中…' : '出力'}
          </Button>
        </>
      }
    >
      <div className={styles.layout}>
        <p className={styles.description}>
          現在のフィルタ・粒度・依存線表示の状態がそのまま PDF
          に反映されます。「両方」はタスク一覧とガントチャートを横並びの 1
          ページに収めて出力します（時間軸は期間に合わせて自動調整）。
        </p>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>出力対象</legend>
          <label className={styles.radio}>
            <input
              type="radio"
              name="kind"
              value="list"
              checked={kind === 'list'}
              onChange={() => setKind('list')}
            />
            タスク一覧のみ
          </label>
          <label className={styles.radio}>
            <input
              type="radio"
              name="kind"
              value="gantt"
              checked={kind === 'gantt'}
              onChange={() => setKind('gantt')}
            />
            ガントチャートのみ
          </label>
          <label className={styles.radio}>
            <input
              type="radio"
              name="kind"
              value="both"
              checked={kind === 'both'}
              onChange={() => setKind('both')}
            />
            両方
          </label>
        </fieldset>

        <p className={styles.count}>
          対象タスク件数: <strong>{targetCount}</strong>
          {disabledNoTasks ? (
            <span className={styles.warn}>（0 件のため出力できません）</span>
          ) : null}
        </p>
      </div>
    </Modal>
  );
}
