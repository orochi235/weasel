/** A plot page holding a gantt as Mermaid `gantt` text. */
import { formatGanttEnd, formatGanttStart, type GanttData, type GanttTask } from '@weasel-js/plot';
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { freshId } from '@weasel-js/registry';
import { lineOpening, spelledLine } from '../common/text';
import { TAGS } from './parse';

/** Words that open a gantt statement other than a task. */
const STATEMENTS = ['title', 'dateFormat', 'axisFormat', 'excludes', 'todayMarker', 'section', 'click', 'call'];

/**
 * A task's items after the colon. Mermaid names no task that starts where the one before it ends, so such a task
 * with an id starts `after` that task's id, and loses its own id when that task has none.
 */
function taskItems(task: GanttTask, before: GanttTask | undefined, ids: ReadonlyMap<string, string>, warnings: Warnings): string[] {
  const items: string[] = [...(task.tags ?? [])];
  const idOf = (id: string) => ids.get(id) ?? id;
  const start = task.start.kind === 'after' ? { ...task.start, ids: task.start.ids.map(idOf) } : task.start;
  const end = formatGanttEnd(task.end.kind === 'until' ? { ...task.end, ids: task.end.ids.map(idOf) } : task.end);
  if (start.kind !== 'previous') return [...items, ...(task.id !== undefined ? [idOf(task.id)] : []), formatGanttStart(start), end];
  if (task.id === undefined) return [...items, end];
  if (before?.id !== undefined) return [...items, idOf(task.id), `after ${idOf(before.id)}`, end];
  warnings.add('Mermaid gives no id to a first task, or one after a task with none, unless it has a start of its own; those ids were dropped.');
  return [...items, end];
}

/** Each task id the reader would take for a tag, as the first free `id_n`. `warnings` hears when there is one. */
function taskIds(data: GanttData, warnings: Warnings): Map<string, string> {
  const taken = new Set(data.sections.flatMap((s) => s.tasks.flatMap((t) => (t.id !== undefined ? [t.id] : []))));
  const out = new Map<string, string>();
  for (const id of [...taken]) {
    if (!TAGS.has(id)) continue;
    const pick = freshId(id, taken, { sep: '_' });
    taken.add(pick);
    out.set(id, pick);
    warnings.add('Mermaid reads a task id that is a tag word as a tag; those ids were renamed.');
  }
  return out;
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
  const text = (s: string) => spelledLine(s, 'gantt', (m) => warnings.add(m));
  const lines = ['gantt', ...settingLines(data, text)];
  const ids = taskIds(data, warnings);
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
      lines.push(`${named ? '    ' : '  '}${lineOpening(text(task.name).trim(), STATEMENTS)} :${taskItems(task, before, ids, warnings).join(', ')}`);
      before = task;
    }
  });
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
