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
  doc.setFont('helvetica');
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
  const scaleX = targetWidth / svgWidth;
  const scaleY = targetHeight / svgHeight;
  const scale = Math.min(scaleX, scaleY);

  await svg2pdf(svg, doc, {
    x: MARGIN,
    y: MARGIN + 8,
    width: svgWidth * scale,
    height: svgHeight * scale,
  });
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
