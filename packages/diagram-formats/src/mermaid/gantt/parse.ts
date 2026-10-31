/** A Mermaid gantt's task lines read into tasks, their starts and ends kept as written. */
import type { GanttEnd, GanttStart, GanttTag, GanttTask, GanttUnit } from '@weasel-js/plot';
import { lineError } from '../../lineError';

const TAGS = new Set(['done', 'active', 'crit', 'milestone', 'vert']);
const DURATION = /^(\d+(?:\.\d+)?|\.\d+)(ms|[smhdwMy])$/;

/** Task text as written, `#58;` read back as the colon Mermaid splits a task on. */
export const ganttText = (s: string): string => s.trim().replace(/#58;/g, ':');

/** `after a b` as its ids, else a date as written. */
function startOf(text: string): GanttStart {
  const after = /^after\s+(.+)$/.exec(text);
  return after !== null ? { kind: 'after', ids: after[1]!.trim().split(/\s+/) } : { kind: 'date', date: text };
}

/** `until a b` as its ids, a duration (`3d`, `1.5h`) as its amount and unit, else a date as written. */
function endOf(text: string): GanttEnd {
  const until = /^until\s+(.+)$/.exec(text);
  if (until !== null) return { kind: 'until', ids: until[1]!.trim().split(/\s+/) };
  const d = DURATION.exec(text);
  return d !== null ? { kind: 'duration', amount: Number(d[1]), unit: d[2] as GanttUnit } : { kind: 'date', date: text };
}

/** A task line read: the task, or `'vert'` for a vertical marker, which a chart does not hold. */
export function parseGanttTask(text: string, line: number): GanttTask | 'vert' {
  const colon = text.indexOf(':');
  if (colon < 0) throw lineError('Mermaid', line, `"${text}" is not a gantt statement`);
  const name = ganttText(text.slice(0, colon));
  const items = text.slice(colon + 1).split(',').map((s) => s.trim());
  const tags: string[] = [];
  while (items.length > 0 && TAGS.has(items[0]!)) tags.push(items.shift()!);
  if (tags.includes('vert')) return 'vert';
  if (items.length > 3) throw lineError('Mermaid', line, 'a task takes an id, a start and an end after its tags, and no more');
  if (items.length === 0 || items.some((s) => s === '')) throw lineError('Mermaid', line, 'a task needs an end');
  const [id, start, end] = items.length === 3 ? items : items.length === 2 ? [undefined, ...items] : [undefined, undefined, items[0]];
  return {
    name,
    ...(id !== undefined ? { id } : {}),
    ...(tags.length > 0 ? { tags: [...new Set(tags)] as GanttTag[] } : {}),
    start: start === undefined ? { kind: 'previous' } : startOf(start),
    end: endOf(end!),
  };
}
