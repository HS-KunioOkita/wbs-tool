import type * as React from 'react';
import type { TaskDto } from '@wbs-tool/shared';
import { dateToX, rowToY, type GanttLayout } from './coordinates.js';
import { isOverdue } from '../../../utils/date.js';

interface Props {
  task: TaskDto;
  rowIndex: number;
  layout: GanttLayout;
  isSelected: boolean;
  hasChildren: boolean;
  onSelect: (taskId: number) => void;
  onDragStart: (e: React.PointerEvent<SVGRectElement>, mode: DragHandleMode) => void;
}

export type DragHandleMode = 'move' | 'resize-left' | 'resize-right';

const BAR_HEIGHT = 22;
const HANDLE_WIDTH = 6;

/**
 * 1 タスク分のバー描画 + ドラッグハンドル。
 * - 親バー（子を持つ）: グレー、ドラッグハンドル無し（VR-010 UI 抑止）
 * - 期限超過: danger 色 + ⚠ アイコン併用（A11Y-001）
 * - 完了 (progress = 100): success 色
 * - 通常: brand 色、進捗バー internal 塗り
 */
export function GanttBar({
  task,
  rowIndex,
  layout,
  isSelected,
  hasChildren,
  onSelect,
  onDragStart,
}: Props): JSX.Element {
  const x = dateToX(task.start_date, layout);
  const dueX = dateToX(task.due_date, layout);
  const widthDays = Math.max(1, dueX - x + layout.pxPerDay);
  const width = widthDays;
  const y = rowToY(rowIndex, layout) + (layout.rowHeight - BAR_HEIGHT) / 2;

  const completed = task.progress >= 100;
  const overdue = isOverdue(task.due_date, task.progress);

  const fill = hasChildren
    ? 'var(--color-gantt-bar-parent)'
    : completed
      ? 'var(--color-gantt-bar-completed)'
      : overdue
        ? 'var(--color-gantt-bar-overdue)'
        : 'var(--color-gantt-bar-default)';

  const progressWidth = !hasChildren && task.progress > 0 ? (width * task.progress) / 100 : 0;

  const label = `${task.name} (${task.start_date} → ${task.due_date}, ${task.progress}%)`;

  return (
    <g
      aria-label={label}
      data-task-id={task.task_id}
      style={{ cursor: hasChildren ? 'default' : 'grab' }}
    >
      {/* 背景バー */}
      <rect
        x={x}
        y={y}
        width={width}
        height={BAR_HEIGHT}
        rx={3}
        fill={fill}
        opacity={completed ? 0.85 : 1}
        stroke={isSelected ? 'var(--color-border-strong)' : 'transparent'}
        strokeWidth={2}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          onSelect(task.task_id);
          if (!hasChildren) onDragStart(e, 'move');
        }}
      />
      {/* 進捗塗り */}
      {progressWidth > 0 ? (
        <rect
          x={x}
          y={y}
          width={progressWidth}
          height={BAR_HEIGHT}
          rx={3}
          fill="var(--color-gantt-bar-progress)"
          pointerEvents="none"
        />
      ) : null}
      {/* 親タスクは斜線パターン（操作不可表現） */}
      {hasChildren ? (
        <text
          x={x + 4}
          y={y + BAR_HEIGHT - 6}
          fontSize={10}
          fill="var(--color-text-on-color)"
          pointerEvents="none"
        >
          親
        </text>
      ) : null}
      {/* 期限超過アイコン（A11Y-001: 色のみでなくアイコン併用） */}
      {overdue && !completed && !hasChildren ? (
        <text
          x={x + width - 14}
          y={y + BAR_HEIGHT - 6}
          fontSize={12}
          fill="var(--color-text-on-color)"
          pointerEvents="none"
        >
          ⚠
        </text>
      ) : null}
      {/* 完了チェック */}
      {completed && !hasChildren ? (
        <text
          x={x + 4}
          y={y + BAR_HEIGHT - 6}
          fontSize={12}
          fill="var(--color-text-on-color)"
          pointerEvents="none"
        >
          ✓
        </text>
      ) : null}
      {/* リサイズハンドル（左 / 右）— 親タスクは描画しない */}
      {!hasChildren ? (
        <>
          <rect
            x={x}
            y={y}
            width={HANDLE_WIDTH}
            height={BAR_HEIGHT}
            fill="transparent"
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              onSelect(task.task_id);
              onDragStart(e, 'resize-left');
            }}
          />
          <rect
            x={x + width - HANDLE_WIDTH}
            y={y}
            width={HANDLE_WIDTH}
            height={BAR_HEIGHT}
            fill="transparent"
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              onSelect(task.task_id);
              onDragStart(e, 'resize-right');
            }}
          />
        </>
      ) : null}
    </g>
  );
}
