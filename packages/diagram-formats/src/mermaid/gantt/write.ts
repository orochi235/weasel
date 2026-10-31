/** A plot page holding a gantt as Mermaid `gantt` text. */
import type { GanttData, GanttEnd, GanttStart, GanttTask } from '@weasel-js/plot';
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';

/** `s` on one line, the colon Mermaid splits a task on written as `#58;`. */
function oneLine(s: string, warnings: Warnings): string {
  if (/[\r\n]/.test(s)) warnings.add('Mermaid gantt text holds one line; line breaks were written as spaces.');
  return s.replace(/\s*[\r\n]+\s*/g, ' ').replace(/:/g, '#58;');
}

const startText = (s: Exclude<GanttStart, { kind: 'previous' }>): string => (s.kind === 'date' ? s.date : `after ${s.ids.join(' ')}`);

function endText(e: GanttEnd): string {
  if (e.kind === 'date') return e.date;
  if (e.kind === 'until') return `until ${e.ids.join(' ')}`;
  return `${e.amount}${e.unit}`;
}

/**
 * A task's items after the colon. Mermaid names no task that starts where the one before it ends, so such a task
 * with an id starts `after` that task's id, and loses its own id when that task has none.
 */
function taskItems(task: GanttTask, before: GanttTask | undefined, warnings: Warnings): string[] {
  const items: string[] = [...(task.tags ?? [])];
  const end = endText(task.end);
  if (task.start.kind !== 'previous') return [...items, ...(task.id !== undefined ? [task.id] : []), startText(task.start), end];
  if (task.id === undefined) return [...items, end];
  if (before?.id !== undefined) return [...items, task.id, `after ${before.id}`, end];
  warnings.add('Mermaid gives no id to a first task, or one after a task with none, unless it has a start of its own; those ids were dropped.');
  return [...items, end];
}

function settingLines(data: GanttData, text: (s: string) => string): string[] {
  const lines: string[] = [];
  if (data.title !== undefined) lines.push(`  title ${text(data.title)}`);
  if (data.dateFormat !== undefined) lines.push(`  dateFormat ${data.dateFormat}`);
  if (data.axisFormat !== undefined) lines.push(`  axisFormat ${data.axisFormat}`);
  if (data.excludes !== undefined && data.excludes.length > 0) lines.push(`  excludes ${data.excludes.join(', ')}`);
  if (data.todayMarker !== undefined) lines.push(`  todayMarker ${data.todayMarker}`);
  return lines;
}

/** Writes `page`'s gantt as Mermaid. Throws on a page holding another kind of chart. */
export function writeMermaidGantt(page: PlotPage): ExportResult {
  const data = page.data;
  if (data.kind !== 'gantt') throw new Error(`Mermaid writes this chart as a gantt only; the page holds a ${(data as { kind: string }).kind}`);
  const warnings = new Warnings();
  const text = (s: string) => oneLine(s, warnings);
  const lines = ['gantt', ...settingLines(data, text)];
  let before: GanttTask | undefined;
  let named = false;
  data.sections.forEach((section, i) => {
    if (section.name !== undefined) {
      lines.push(`  section ${text(section.name)}`);
      named = true;
    } else if (i > 0) {
      warnings.add('Mermaid holds no unnamed section after the first; its tasks were written into the section before it.');
    }
    for (const task of section.tasks) {
      lines.push(`${named ? '    ' : '  '}${text(task.name)} :${taskItems(task, before, warnings).join(', ')}`);
      before = task;
    }
  });
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
