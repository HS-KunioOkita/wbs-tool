import type { DependencyDto, TaskDto } from '@wbs-tool/shared';
import { dateToX, rowToY, type GanttLayout } from './coordinates.js';

interface Props {
  tasks: ReadonlyArray<TaskDto>;
  dependencies: ReadonlyArray<DependencyDto>;
  layout: GanttLayout;
}

const BAR_HEIGHT = 22;
const ARROW_SIZE = 5;

/**
 * 依存関係の線分描画（先行の右端 → 後続の左端）。
 * 表示 ON 時のみ親側がレンダリングする。
 */
export function DependencyLines({ tasks, dependencies, layout }: Props): JSX.Element {
  const rowByTaskId = new Map<number, number>();
  tasks.forEach((t, i) => rowByTaskId.set(t.task_id, i));
  const taskById = new Map<number, TaskDto>();
  tasks.forEach((t) => taskById.set(t.task_id, t));

  return (
    <g aria-label="依存線" pointerEvents="none">
      {dependencies.map((d) => {
        const pred = taskById.get(d.predecessor_task_id);
        const succ = taskById.get(d.successor_task_id);
        const predRow = rowByTaskId.get(d.predecessor_task_id);
        const succRow = rowByTaskId.get(d.successor_task_id);
        if (!pred || !succ || predRow === undefined || succRow === undefined) return null;

        const predDueX = dateToX(pred.due_date, layout) + layout.pxPerDay; // バー右端
        const succStartX = dateToX(succ.start_date, layout);

        const predY = rowToY(predRow, layout) + layout.rowHeight / 2;
        const succY =
          rowToY(succRow, layout) + (layout.rowHeight - BAR_HEIGHT) / 2 + BAR_HEIGHT / 2;

        // 折れ線（水平 → 垂直 → 水平 → 矢印）
        const midX = Math.max(predDueX + 8, succStartX - 8);
        const path = `M ${predDueX} ${predY} L ${midX} ${predY} L ${midX} ${succY} L ${succStartX - ARROW_SIZE} ${succY}`;
        const arrow = `M ${succStartX} ${succY} L ${succStartX - ARROW_SIZE} ${succY - ARROW_SIZE / 1.5} L ${succStartX - ARROW_SIZE} ${succY + ARROW_SIZE / 1.5} Z`;

        return (
          <g key={d.dependency_id}>
            <path
              d={path}
              fill="none"
              stroke="var(--color-gantt-dependency-line)"
              strokeWidth={1.5}
            />
            <path d={arrow} fill="var(--color-gantt-dependency-line)" />
          </g>
        );
      })}
    </g>
  );
}
