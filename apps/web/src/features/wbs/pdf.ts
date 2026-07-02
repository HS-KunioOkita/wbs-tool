import type { TaskDto } from '@wbs-tool/shared';
import jsPDF from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';

/**
 * UC-009 PDF エクスポート。
 * - 対象 0 件は呼出側で抑止（ERR-004）
 * - ファイル名規則（OPEN-06）: `{projectName}_{kind}_{YYYYMMDD-HHMMSS}.pdf`
 * - 「タスク一覧」「ガントチャート」「両方」を切り替える
 */

export type ExportKind = 'list' | 'gantt' | 'both';

const PAGE_WIDTH = 297; // A4 横向き mm
const PAGE_HEIGHT = 210;
const MARGIN = 12;

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
  ganttSvg: SVGSVGElement | null;
}): Promise<{ filename: string }> {
  if (input.tasks.length === 0) {
    throw new Error('対象タスクがありません');
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await registerJapaneseFont(doc);
  doc.setFont(FONT_FAMILY, 'normal');
  let first = true;

  if (input.kind === 'list' || input.kind === 'both') {
    if (!first) doc.addPage();
    renderTaskListPage(doc, input.projectName, input.tasks);
    first = false;
  }

  if ((input.kind === 'gantt' || input.kind === 'both') && input.ganttSvg) {
    if (!first) doc.addPage();
    await renderGanttPage(doc, input.projectName, input.ganttSvg);
    first = false;
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
