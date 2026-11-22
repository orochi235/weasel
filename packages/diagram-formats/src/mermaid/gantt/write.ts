/** A plot page holding a gantt as Mermaid `gantt` text. */
import { formatGanttEnd, formatGanttStart, setGanttTaskId, type GanttData, type GanttTask } from '@weasel-js/plot';
import type { ExportResult, PlotPage } from '../../document';
import { Warnings } from '../../graphRead';
import { freshId } from '@weasel-js/registry';
import { warnDroppedPageName } from '../common/lines';
import { lineOpening, spelledLine } from '../common/text';
import { TAGS } from './parse';

/** Words that open a gantt statement other than a task. */
const STATEMENTS = ['title', 'dateFormat', 'axisFormat', 'excludes', 'todayMarker', 'section', 'click', 'call'];

const DROPPED_ID = 'Mermaid gives no id to a first task, or one after a task with none, unless it has a start of its own; those ids were dropped.';

/**
 * `data` less the ids Mermaid cannot write. It names no task that starts where the one before it ends, so such a task
 * is written `after` the task before's id, and cannot keep its own when that task has none. A task starting after or
 * ending at a dropped id follows the task before it, or lasts a day, which may drop its own id in turn.
 */
function writableIds(data: GanttData, warnings: Warnings): GanttData {
  for (;;) {
    let before: GanttTask | undefined;
    let drop: [number, number, string] | undefined;
    data.sections.forEach((section, s) => section.tasks.forEach((task, t) => {
      if (drop === undefined && task.id !== undefined && task.start.kind === 'previous' && before?.id === undefined) drop = [s, t, task.id];
      before = task;
    }));
    if (drop === undefined) return data;
    const id = drop[2];
    warnings.add(DROPPED_ID);
    const named = data.sections.some((sec) => sec.tasks.some((t) =>
      (t.start.kind === 'after' && t.start.ids.includes(id)) || (t.end.kind === 'until' && t.end.ids.includes(id))));
    if (named) warnings.add('Tasks starting after or ending at a task whose id was dropped follow the task before them, or last a day.');
    data = setGanttTaskId(data, drop[0], drop[1], undefined);
  }
}

/** A task's items after the colon, a task starting where the one before it ends written `after` that one's id. */
function taskItems(task: GanttTask, before: GanttTask | undefined, ids: ReadonlyMap<string, string>): string[] {
  const items: string[] = [...(task.tags ?? [])];
  const idOf = (id: string) => ids.get(id) ?? id;
  const start = task.start.kind === 'after' ? { ...task.start, ids: task.start.ids.map(idOf) } : task.start;
  const end = formatGanttEnd(task.end.kind === 'until' ? { ...task.end, ids: task.end.ids.map(idOf) } : task.end);
  if (start.kind !== 'previous') return [...items, ...(task.id !== undefined ? [idOf(task.id)] : []), formatGanttStart(start), end];
  if (task.id === undefined) return [...items, end];
  return [...items, idOf(task.id), `after ${idOf(before!.id!)}`, end];
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
  if (page.data.kind !== 'gantt') throw new Error(`Mermaid writes this chart as a gantt only; the page holds a ${(page.data as { kind: string }).kind}`);
  const warnings = new Warnings();
  warnDroppedPageName(page, (m) => warnings.add(m));
  const data = writableIds(page.data, warnings);
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
      const items = ` :${taskItems(task, before, ids).join(', ')}`;
      lines.push(`${named ? '    ' : '  '}${lineOpening(text(task.name).trim(), STATEMENTS, items)}${items}`);
      before = task;
    }
  });
  return { text: `${lines.join('\n')}\n`, warnings: warnings.all() };
}
