/** A Mermaid gantt's task lines read into tasks, their starts and ends kept as written. */
import { parseGanttEnd, parseGanttStart, type GanttTag, type GanttTask } from '@weasel-js/plot';
import { lineError } from '../../lineError';

const TAGS = new Set(['done', 'active', 'crit', 'milestone', 'vert']);

/** Task text as written, `#58;` read back as the colon Mermaid splits a task on. */
export const ganttText = (s: string): string => s.trim().replace(/#58;/g, ':');

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
    start: start === undefined ? { kind: 'previous' } : parseGanttStart(start),
    end: parseGanttEnd(end!),
  };
}
