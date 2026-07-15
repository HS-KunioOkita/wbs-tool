import type { DependencyDto, TaskDto } from '@wbs-tool/shared';
import jsPDF from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { isOverdue, todayLocalIso } from '../../utils/date.js';
import {
  addDaysIso,
  dateToX,
  diffDays,
  makeMonthTicks,
  PADDING_DAYS,
  type GanttLayout,
} from './gantt/coordinates.js';
import { hasChildren } from './gantt/drag.js';

/**
 * UC-009 PDF エクスポート。
 * - 対象 0 件は呼出側で抑止（ERR-004）
 * - ファイル名規則（OPEN-06）: `{projectName}_{kind}_{YYYYMMDD-HHMMSS}.pdf`
 * - 「タスク一覧」「ガントチャート」「両方」を切り替える
 * - 「両方」はタスク一覧（左）とガントチャート（右）を同一ページに横並びで描画し、
 *   行を共有することでタスクとバーの対応を明示する（HO-I-006）
 */

export type ExportKind = 'list' | 'gantt' | 'both';

const PAGE_WIDTH = 297; // A4 横向き mm
const PAGE_HEIGHT = 210;
const MARGIN = 12;

// tokens.css（DTK-001〜）ライトモードの実値。jsPDF は CSS カスタムプロパティを
// 解決できないため、ガント配色トークンと同じ RGB を直接指定する。
type Rgb = readonly [number, number, number];
const COLOR: Record<
  | 'text'
  | 'textMuted'
  | 'headerFill'
  | 'stripeFill'
  | 'gridLine'
  | 'barDefault'
  | 'barParent'
  | 'barOverdue'
  | 'barCompleted'
  | 'barProgress'
  | 'dependencyLine'
  | 'todayLine',
  Rgb
> = {
  text: [17, 24, 39],
  textMuted: [107, 114, 128],
  headerFill: [243, 244, 246],
  stripeFill: [249, 250, 251],
  gridLine: [229, 231, 235],
  barDefault: [37, 99, 235],
  barParent: [107, 114, 128],
  barOverdue: [220, 38, 38],
  barCompleted: [22, 163, 74],
  barProgress: [30, 64, 175],
  dependencyLine: [107, 114, 128],
  todayLine: [14, 165, 233],
};

// jsPDF 組み込みフォント（Helvetica 等）は日本語グリフを持たず文字化けするため、
// 日本語対応 TTF（Sawarabi Gothic / SIL OFL）を埋め込んで使用する。
const FONT_URL = '/fonts/SawarabiGothic-Regular.ttf';
const FONT_VFS = 'SawarabiGothic-Regular.ttf';
const FONT_FAMILY = 'SawarabiGothic';

let fontBase64Promise: Promise<string> | null = null;

/** フォントを 1 回だけ取得して base64 をキャッシュする（メイン JS バンドルには含めない）。 */
function loadFontBase64(): Promise<string> {
  if (!fontBase64Promise) {
    fontBase64Promise = fetch(FONT_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`PDF 用フォントの読み込みに失敗しました (${res.status})`);
        return res.arrayBuffer();
      })
      .then(arrayBufferToBase64)
      .catch((err) => {
        fontBase64Promise = null; // 失敗時は次回再試行できるようキャッシュを破棄
        throw err;
      });
  }
  return fontBase64Promise;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000; // String.fromCharCode のスタック上限を避けて分割変換
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** 日本語フォントを doc に登録する。bold も同一 TTF を割り当て、svg2pdf の太字解決で times に落ちないようにする。 */
async function registerJapaneseFont(doc: jsPDF): Promise<void> {
  const base64 = await loadFontBase64();
  doc.addFileToVFS(FONT_VFS, base64);
  doc.addFont(FONT_VFS, FONT_FAMILY, 'normal');
  doc.addFont(FONT_VFS, FONT_FAMILY, 'bold');
}

export async function exportPdf(input: {
  projectName: string;
  kind: ExportKind;
  tasks: ReadonlyArray<TaskDto>;
  dependencies: ReadonlyArray<DependencyDto>;
  showDependencies: boolean;
  ganttSvg: SVGSVGElement | null;
}): Promise<{ filename: string }> {
  if (input.tasks.length === 0) {
    throw new Error('対象タスクがありません');
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await registerJapaneseFont(doc);
  doc.setFont(FONT_FAMILY, 'normal');

  if (input.kind === 'both') {
    renderCombinedPages(doc, input);
  } else if (input.kind === 'list') {
    renderTaskListPage(doc, input.projectName, input.tasks);
  } else if (input.ganttSvg) {
    await renderGanttPage(doc, input.projectName, input.ganttSvg);
  }

  const filename = makeFilename(input.projectName, input.kind);
  doc.save(filename);
  return { filename };
}

function makeFilename(projectName: string, kind: ExportKind): string {
  const safe = sanitize(projectName);
  const ts = timestamp();
  const suffix = kind === 'list' ? 'tasks' : kind === 'gantt' ? 'gantt' : 'wbs';
  return `${safe}_${suffix}_${ts}.pdf`;
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80) || 'project';
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function renderTaskListPage(doc: jsPDF, projectName: string, tasks: ReadonlyArray<TaskDto>): void {
  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(14);
  doc.text(`${projectName} - タスク一覧`, MARGIN, MARGIN + 4);

  doc.setFontSize(9);
  const headers = ['#', 'タスク名', '担当者', '開始日', '期限', '進捗'];
  const colX = [MARGIN, MARGIN + 12, MARGIN + 110, MARGIN + 150, MARGIN + 180, MARGIN + 215];

  let y = MARGIN + 14;
  doc.setFillColor(243, 244, 246);
  doc.rect(MARGIN, y - 4, PAGE_WIDTH - MARGIN * 2, 6, 'F');
  headers.forEach((h, i) => doc.text(h, colX[i]!, y));

  y += 6;
  const rowHeight = 5;
  for (const t of tasks) {
    if (y > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN + 8;
    }
    doc.text(String(t.task_id), colX[0]!, y);
    doc.text(truncate(t.name, 60), colX[1]!, y);
    doc.text(truncate(t.assignee || '-', 18), colX[2]!, y);
    doc.text(t.start_date, colX[3]!, y);
    doc.text(t.due_date, colX[4]!, y);
    doc.text(`${t.progress}%`, colX[5]!, y);
    y += rowHeight;
  }
}

/**
 * 「両方」出力: タスク一覧（左）とガントチャート（右）を同一ページに横並びで描画する。
 * - 行順は UI-003 のガントと同じ task_id 昇順で、表の行とバーが同じ高さに並ぶ
 * - 時間軸は全期間（前後 PADDING_DAYS 込み）がガント領域の幅に収まるよう自動スケール
 * - バー配色は GanttBar と同じ規則（親 / 完了 / 期限超過 / 通常 + 進捗塗り）
 * - 1 ページに収まらない場合は行単位で改ページし、ヘッダ（表見出し + 月目盛り）を再描画する
 */
function renderCombinedPages(
  doc: jsPDF,
  input: {
    projectName: string;
    tasks: ReadonlyArray<TaskDto>;
    dependencies: ReadonlyArray<DependencyDto>;
    showDependencies: boolean;
  },
): void {
  const ordered = [...input.tasks].sort((a, b) => a.task_id - b.task_id);

  // 左: タスク表の列 x 座標（mm）
  const col = {
    no: MARGIN,
    name: MARGIN + 10,
    assignee: MARGIN + 64,
    start: MARGIN + 86,
    due: MARGIN + 106,
    progress: MARGIN + 126,
  };
  const tableWidth = 138;
  const ganttX = MARGIN + tableWidth + 4;
  const ganttWidth = PAGE_WIDTH - MARGIN - ganttX;

  // 時間軸: 全タスクの期間 + 前後マージンをガント幅へ収める。
  // coordinates.ts の座標演算は単位非依存のため pxPerDay に mm/日 を渡して流用する。
  let minDate = ordered[0]!.start_date;
  let maxDate = ordered[0]!.due_date;
  for (const t of ordered) {
    if (t.start_date < minDate) minDate = t.start_date;
    if (t.due_date > maxDate) maxDate = t.due_date;
  }
  const originDate = addDaysIso(minDate, -PADDING_DAYS);
  const totalDays = diffDays(originDate, addDaysIso(maxDate, PADDING_DAYS)) + 1;
  const axisHeight = 7;
  const rowStep = 6.5;
  const barHeight = 4;
  const layout: GanttLayout = {
    originDate,
    pxPerDay: ganttWidth / totalDays,
    headerHeight: axisHeight,
    rowHeight: rowStep,
    totalDays,
  };

  const contentTop = MARGIN + 10;
  const bodyTop = contentTop + axisHeight;
  const rowsPerPage = Math.max(1, Math.floor((PAGE_HEIGHT - MARGIN - bodyTop) / rowStep));
  const today = todayLocalIso();
  const taskById = new Map(ordered.map((t) => [t.task_id, t]));

  for (let offset = 0; offset < ordered.length; offset += rowsPerPage) {
    if (offset > 0) doc.addPage();
    const pageTasks = ordered.slice(offset, offset + rowsPerPage);
    const bodyBottom = bodyTop + pageTasks.length * rowStep;

    doc.setTextColor(...COLOR.text);
    doc.setFontSize(14);
    doc.text(`${input.projectName} - タスク一覧 / ガントチャート`, MARGIN, MARGIN + 4);

    // ヘッダ帯（表見出しと時間軸を同じ帯に描く）
    doc.setFillColor(...COLOR.headerFill);
    doc.rect(MARGIN, contentTop, PAGE_WIDTH - MARGIN * 2, axisHeight, 'F');

    // 行縞: ガント領域まで通して引き、行の対応を追いやすくする
    doc.setFillColor(...COLOR.stripeFill);
    pageTasks.forEach((_, i) => {
      if ((offset + i) % 2 === 1) {
        doc.rect(MARGIN, bodyTop + i * rowStep, PAGE_WIDTH - MARGIN * 2, rowStep, 'F');
      }
    });

    const headerBaseline = contentTop + axisHeight - 2.2;
    doc.setFontSize(8);
    doc.text('#', col.no, headerBaseline);
    doc.text('タスク名', col.name, headerBaseline);
    doc.text('担当者', col.assignee, headerBaseline);
    doc.text('開始日', col.start, headerBaseline);
    doc.text('期限', col.due, headerBaseline);
    doc.text('進捗', col.progress, headerBaseline);

    // 月目盛り: 境界線は常に、ラベルは月幅に収まる場合のみ描く
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR.textMuted);
    doc.setDrawColor(...COLOR.gridLine);
    doc.setLineWidth(0.15);
    for (const tick of makeMonthTicks(layout)) {
      const x = ganttX + tick.x;
      doc.line(x, contentTop, x, bodyBottom);
      if (tick.widthPx >= doc.getTextWidth(tick.label) + 1.5) {
        doc.text(tick.label, x + 0.8, headerBaseline);
      }
    }

    // タスク行（表テキスト + バー）
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.text);
    pageTasks.forEach((t, i) => {
      const rowTop = bodyTop + i * rowStep;
      const baseline = rowTop + rowStep / 2 + 1;
      doc.text(String(t.task_id), col.no, baseline);
      doc.text(truncateToWidth(doc, t.name, col.assignee - col.name - 2), col.name, baseline);
      doc.text(
        truncateToWidth(doc, t.assignee || '-', col.start - col.assignee - 2),
        col.assignee,
        baseline,
      );
      doc.text(t.start_date, col.start, baseline);
      doc.text(t.due_date, col.due, baseline);
      doc.text(`${t.progress}%`, col.progress, baseline);

      const barX = ganttX + dateToX(t.start_date, layout);
      const barWidth = Math.max(
        layout.pxPerDay,
        dateToX(t.due_date, layout) - dateToX(t.start_date, layout) + layout.pxPerDay,
      );
      const barY = rowTop + (rowStep - barHeight) / 2;
      const parent = hasChildren(t.task_id, ordered);
      const barColor = parent
        ? COLOR.barParent
        : t.progress >= 100
          ? COLOR.barCompleted
          : isOverdue(t.due_date, t.progress, today)
            ? COLOR.barOverdue
            : COLOR.barDefault;
      doc.setFillColor(...barColor);
      doc.roundedRect(barX, barY, barWidth, barHeight, 0.8, 0.8, 'F');
      if (!parent && t.progress > 0) {
        doc.setFillColor(...COLOR.barProgress);
        doc.roundedRect(barX, barY, (barWidth * t.progress) / 100, barHeight, 0.8, 0.8, 'F');
      }
    });

    // 依存線（先行の右端 → 後続の左端）。ページをまたぐ依存は行対応が示せないため省略する
    if (input.showDependencies) {
      const rowIndexByTaskId = new Map<number, number>();
      pageTasks.forEach((t, i) => rowIndexByTaskId.set(t.task_id, i));
      doc.setDrawColor(...COLOR.dependencyLine);
      doc.setFillColor(...COLOR.dependencyLine);
      doc.setLineWidth(0.3);
      for (const d of input.dependencies) {
        const predRow = rowIndexByTaskId.get(d.predecessor_task_id);
        const succRow = rowIndexByTaskId.get(d.successor_task_id);
        if (predRow === undefined || succRow === undefined) continue;
        const pred = taskById.get(d.predecessor_task_id)!;
        const succ = taskById.get(d.successor_task_id)!;
        const predX = ganttX + dateToX(pred.due_date, layout) + layout.pxPerDay;
        const succX = ganttX + dateToX(succ.start_date, layout);
        const predY = bodyTop + predRow * rowStep + rowStep / 2;
        const succY = bodyTop + succRow * rowStep + rowStep / 2;
        const midX = Math.max(predX + 1.5, succX - 1.5);
        doc.line(predX, predY, midX, predY);
        doc.line(midX, predY, midX, succY);
        doc.line(midX, succY, Math.min(succX - 1.2, midX), succY);
        doc.triangle(succX, succY, succX - 1.2, succY - 0.8, succX - 1.2, succY + 0.8, 'F');
      }
    }

    // 今日マーカー
    if (today >= originDate && diffDays(originDate, today) < totalDays) {
      const todayX = ganttX + dateToX(today, layout) + layout.pxPerDay / 2;
      doc.setDrawColor(...COLOR.todayLine);
      doc.setLineWidth(0.3);
      doc.line(todayX, contentTop, todayX, bodyBottom);
    }
  }
}

/** 現在のフォント設定で maxWidth (mm) に収まるよう、超過分を「…」に置き換える。 */
function truncateToWidth(doc: jsPDF, s: string, maxWidth: number): string {
  if (doc.getTextWidth(s) <= maxWidth) return s;
  let t = s;
  while (t.length > 0 && doc.getTextWidth(t + '…') > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

async function renderGanttPage(doc: jsPDF, projectName: string, svg: SVGSVGElement): Promise<void> {
  doc.setFontSize(14);
  doc.text(`${projectName} - ガントチャート`, MARGIN, MARGIN + 4);

  const targetWidth = PAGE_WIDTH - MARGIN * 2;
  const targetHeight = PAGE_HEIGHT - MARGIN * 2 - 8;

  // svg2pdf は px → mm のスケールを内部で行う。viewBox から比率を決める。
  const svgWidth = Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
  const svgHeight = Number(svg.getAttribute('height')) || svg.getBoundingClientRect().height;
  const scale = Math.min(targetWidth / svgWidth, targetHeight / svgHeight);

  const exportSvg = prepareGanttSvgForExport(svg);
  try {
    await svg2pdf(exportSvg.svg, doc, {
      x: MARGIN,
      y: MARGIN + 8,
      width: svgWidth * scale,
      height: svgHeight * scale,
    });
  } finally {
    exportSvg.cleanup();
  }
}

/**
 * ガント SVG をエクスポート用に複製し、CSS カスタムプロパティを解決した具体値へ変換する。
 * svg2pdf は getComputedStyle を使わず属性を生のまま読むため、`fill="var(--*)"` のままだと
 * 色を解釈できずガントが真っ白になる。複製を画面外に実体化し、計算済みの色とフォントを
 * 属性へ書き戻してから渡す。cleanup() で一時 DOM を破棄する。
 */
function prepareGanttSvgForExport(source: SVGSVGElement): {
  svg: SVGSVGElement;
  cleanup: () => void;
} {
  const clone = source.cloneNode(true) as SVGSVGElement;
  // svg2pdf は font-family を jsPDF 登録フォントへ解決する。日本語フォントを明示する。
  clone.setAttribute('font-family', FONT_FAMILY);

  // getComputedStyle / getBBox が機能するよう、画面外に実体を配置する。
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;';
  host.appendChild(clone);
  document.body.appendChild(host);

  for (const el of [clone, ...clone.querySelectorAll<SVGElement>('*')]) {
    const cs = getComputedStyle(el);
    if (cs.fill) el.setAttribute('fill', cs.fill);
    if (cs.stroke) el.setAttribute('stroke', cs.stroke);
  }

  return { svg: clone, cleanup: () => host.remove() };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
