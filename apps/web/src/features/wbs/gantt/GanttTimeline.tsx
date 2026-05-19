import { useMemo } from 'react';
import {
  HEADER_HEIGHT,
  dateToX,
  makeDayTicks,
  makeMonthTicks,
  type GanttLayout,
  type Granularity,
} from './coordinates.js';
import { todayLocalIso } from '../../../utils/date.js';

interface Props {
  layout: GanttLayout;
  granularity: Granularity;
  width: number;
  height: number;
}

/**
 * ガントチャートのタイムライン軸 + 今日マーカー（縦線）。
 * sticky にしないので、親側で fixed 配置するか scroll 同期する。
 */
export function GanttTimeline({ layout, granularity, width, height }: Props): JSX.Element {
  const today = todayLocalIso();
  const todayX = dateToX(today, layout);
  const showTodayLine = todayX >= 0 && todayX <= width;

  if (granularity === 'day') {
    const ticks = useMemo(() => makeDayTicks(layout), [layout]);
    return (
      <g aria-label="タイムライン (日)">
        {/* 月境界の縦線（強） */}
        {ticks
          .filter((t) => t.isMonthStart)
          .map((t) => (
            <line
              key={`m-${t.date}`}
              x1={t.x}
              x2={t.x}
              y1={0}
              y2={height}
              stroke="var(--color-border-default)"
              strokeWidth={1}
            />
          ))}
        {/* 日ラベル */}
        {ticks.map((t) => (
          <text
            key={t.date}
            x={t.x + 2}
            y={HEADER_HEIGHT - 8}
            fontSize={10}
            fill="var(--color-text-tertiary)"
          >
            {Number(t.date.slice(8, 10))}
          </text>
        ))}
        {/* 月ラベル（月初） */}
        {ticks
          .filter((t) => t.isMonthStart)
          .map((t) => (
            <text
              key={`ml-${t.date}`}
              x={t.x + 4}
              y={16}
              fontSize={11}
              fontWeight={600}
              fill="var(--color-text-secondary)"
            >
              {`${t.date.slice(0, 4)}/${t.date.slice(5, 7)}`}
            </text>
          ))}
        {showTodayLine ? (
          <line
            x1={todayX}
            x2={todayX}
            y1={0}
            y2={height}
            stroke="var(--color-gantt-today-line)"
            strokeWidth={2}
            aria-label="今日"
          />
        ) : null}
      </g>
    );
  }

  // granularity === 'month'
  const monthTicks = useMemo(() => makeMonthTicks(layout), [layout]);
  return (
    <g aria-label="タイムライン (月)">
      {monthTicks.map((t) => (
        <g key={t.label}>
          <line
            x1={t.x}
            x2={t.x}
            y1={0}
            y2={height}
            stroke="var(--color-border-default)"
            strokeWidth={1}
          />
          <text
            x={t.x + 4}
            y={20}
            fontSize={12}
            fontWeight={600}
            fill="var(--color-text-secondary)"
          >
            {t.label}
          </text>
        </g>
      ))}
      {showTodayLine ? (
        <line
          x1={todayX}
          x2={todayX}
          y1={0}
          y2={height}
          stroke="var(--color-gantt-today-line)"
          strokeWidth={2}
          aria-label="今日"
        />
      ) : null}
    </g>
  );
}
