import type * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { DependencyDto, TaskDto } from '@wbs-tool/shared';
import { ApiError, tasksApi } from '../../../api/index.js';
import { pushErrorToast } from '../../../store/toast-store.js';
import {
  chartHeight,
  chartWidth,
  computeLayout,
  dateToX,
  rowToY,
  type Granularity,
} from './coordinates.js';
import { DependencyLines } from './DependencyLines.js';
import { GanttBar, type DragHandleMode } from './GanttBar.js';
import { GanttTimeline } from './GanttTimeline.js';
import { computeDragResult, hasChildren as hasChildrenOf } from './drag.js';

interface Props {
  tasks: ReadonlyArray<TaskDto>;
  dependencies: ReadonlyArray<DependencyDto>;
  granularity: Granularity;
  showDependencies: boolean;
  selectedTaskId: number | null;
  onSelect: (taskId: number) => void;
  onTaskUpdated: () => Promise<void> | void;
}

interface DragState {
  taskId: number;
  mode: DragHandleMode;
  startClientX: number;
  originalStartDate: string;
  originalDueDate: string;
  previewStart: string;
  previewDue: string;
  valid: boolean;
}

/**
 * UI-003 右ペインのガントチャート（SVG 自前描画）。
 * - 楽観的更新は採らない（RISK-002）: ドロップ後 API-009 応答までは確定描画を保留
 * - 親バーはドラッグハンドル非表示で UI 側抑止（VR-010）、サーバ側でも 422 で再防御
 */
export function GanttChart({
  tasks,
  dependencies,
  granularity,
  showDependencies,
  selectedTaskId,
  onSelect,
  onTaskUpdated,
}: Props): JSX.Element {
  const layout = useMemo(() => computeLayout({ tasks, granularity }), [tasks, granularity]);
  const orderedTasks = useMemo(() => [...tasks].sort((a, b) => a.task_id - b.task_id), [tasks]);

  const width = chartWidth(layout);
  const height = chartHeight(orderedTasks.length, layout);

  const [drag, setDrag] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const onDragStart = useCallback(
    (e: React.PointerEvent<SVGRectElement>, mode: DragHandleMode, task: TaskDto) => {
      if (hasChildrenOf(task.task_id, orderedTasks)) {
        pushErrorToast({
          code: 'ERR-004',
          message: '親タスクは直接ドラッグできません',
        });
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      setDrag({
        taskId: task.task_id,
        mode,
        startClientX: e.clientX,
        originalStartDate: task.start_date,
        originalDueDate: task.due_date,
        previewStart: task.start_date,
        previewDue: task.due_date,
        valid: true,
      });
    },
    [orderedTasks],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drag) return;
      const deltaPx = e.clientX - drag.startClientX;
      const result = computeDragResult({
        mode: drag.mode,
        originalStartDate: drag.originalStartDate,
        originalDueDate: drag.originalDueDate,
        deltaPx,
        layout,
      });
      setDrag({
        ...drag,
        previewStart: result.startDate,
        previewDue: result.dueDate,
        valid: result.valid,
      });
    },
    [drag, layout],
  );

  const onPointerUp = useCallback(async () => {
    if (!drag) return;
    const local = drag;
    setDrag(null);

    // VR-002 違反位置でドロップされた場合は確定しない（UC-007 例外フロー）
    if (!local.valid) return;
    if (
      local.previewStart === local.originalStartDate &&
      local.previewDue === local.originalDueDate
    ) {
      return;
    }

    try {
      await tasksApi.updateSchedule(local.taskId, {
        start_date: local.previewStart,
        due_date: local.previewDue,
      });
      await onTaskUpdated();
    } catch (err) {
      if (err instanceof ApiError) pushErrorToast(err);
      else pushErrorToast(err);
    }
  }, [drag, onTaskUpdated]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={Math.max(height, 200)}
      viewBox={`0 0 ${width} ${Math.max(height, 200)}`}
      style={{ display: 'block', backgroundColor: 'var(--color-surface-sunken)' }}
      onPointerMove={onPointerMove}
      onPointerUp={() => void onPointerUp()}
      onPointerLeave={() => void onPointerUp()}
    >
      {/* ヘッダ背景 */}
      <rect x={0} y={0} width={width} height={layout.headerHeight} fill="var(--color-surface)" />

      {/* 行背景（縞模様） */}
      {orderedTasks.map((t, i) => (
        <rect
          key={`row-${t.task_id}`}
          x={0}
          y={rowToY(i, layout)}
          width={width}
          height={layout.rowHeight}
          fill={i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'}
        />
      ))}

      {/* タイムライン軸 + 今日マーカー */}
      <GanttTimeline
        layout={layout}
        granularity={granularity}
        width={width}
        height={Math.max(height, 200)}
      />

      {/* 依存線（表示 ON 時のみ） */}
      {showDependencies ? (
        <DependencyLines tasks={orderedTasks} dependencies={dependencies} layout={layout} />
      ) : null}

      {/* タスクバー */}
      {orderedTasks.map((task, i) => (
        <GanttBar
          key={task.task_id}
          task={task}
          rowIndex={i}
          layout={layout}
          isSelected={task.task_id === selectedTaskId}
          hasChildren={hasChildrenOf(task.task_id, orderedTasks)}
          onSelect={onSelect}
          onDragStart={(e, mode) => onDragStart(e, mode, task)}
        />
      ))}

      {/* ドラッグ中プレビュー（半透明バー） */}
      {drag ? <PreviewBar drag={drag} layout={layout} orderedTasks={orderedTasks} /> : null}
    </svg>
  );
}

function PreviewBar({
  drag,
  layout,
  orderedTasks,
}: {
  drag: DragState;
  layout: ReturnType<typeof computeLayout>;
  orderedTasks: ReadonlyArray<TaskDto>;
}): JSX.Element | null {
  const rowIndex = orderedTasks.findIndex((t) => t.task_id === drag.taskId);
  if (rowIndex < 0) return null;
  const x = dateToX(drag.previewStart, layout);
  const widthPx = dateToX(drag.previewDue, layout) - x + layout.pxPerDay;
  const y = rowToY(rowIndex, layout) + (layout.rowHeight - 22) / 2;
  return (
    <rect
      x={x}
      y={y}
      width={Math.max(layout.pxPerDay, widthPx)}
      height={22}
      rx={3}
      fill={drag.valid ? 'var(--color-brand-primary)' : 'var(--color-danger)'}
      opacity={0.35}
      pointerEvents="none"
    />
  );
}
