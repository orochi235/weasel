/** A task's start and end as written in Mermaid: `after a b`, `until a b`, a duration (`3d`, `1.5h`), or a date. */
import type { GanttEnd, GanttStart, GanttUnit } from './types';

const DURATION = /^(\d+(?:\.\d+)?|\.\d+)(ms|[smhdwMy])$/;
const ids = (text: string): string[] => text.trim().split(/\s+/);

/** `start` as written: `after a b`, a date, or `''` for one that follows the task before it. */
export const formatGanttStart = (start: GanttStart): string =>
  (start.kind === 'date' ? start.date : start.kind === 'after' ? `after ${start.ids.join(' ')}` : '');

/** Text read as a start: `after a b` as its ids, `''` as following the task before, anything else as a date. */
export function parseGanttStart(text: string): GanttStart {
  const t = text.trim();
  if (t === '') return { kind: 'previous' };
  const after = /^after\s+(.+)$/.exec(t);
  return after !== null ? { kind: 'after', ids: ids(after[1]!) } : { kind: 'date', date: t };
}

/** `end` as written: `until a b`, a duration, or a date. */
export function formatGanttEnd(end: GanttEnd): string {
  if (end.kind === 'date') return end.date;
  if (end.kind === 'until') return `until ${end.ids.join(' ')}`;
  return `${end.amount}${end.unit}`;
}

/** Text read as an end: `until a b` as its ids, a duration as its amount and unit, anything else as a date. */
export function parseGanttEnd(text: string): GanttEnd {
  const t = text.trim();
  const until = /^until\s+(.+)$/.exec(t);
  if (until !== null) return { kind: 'until', ids: ids(until[1]!) };
  const d = DURATION.exec(t);
  return d !== null ? { kind: 'duration', amount: Number(d[1]), unit: d[2] as GanttUnit } : { kind: 'date', date: t };
}
