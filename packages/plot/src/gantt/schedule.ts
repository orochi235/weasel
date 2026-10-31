/** A gantt's tasks resolved to instants: dependencies followed, durations counted past excluded days. */
import { GANTT_DATE_FORMAT, parseGanttDate } from './dates';
import type { GanttData, GanttTask, GanttUnit } from './types';

/** Milliseconds in a day. */
export const DAY = 86_400_000;
const HOUR = 3_600_000;
const FIXED: Readonly<Partial<Record<GanttUnit, number>>> = { ms: 1, s: 1000, m: 60_000, h: HOUR };
/** Past this many days, a duration is not walked day by day for excluded days. */
const WALK_LIMIT = 100_000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Where one task runs, in milliseconds since the epoch. */
export interface GanttSpan {
  start: number;
  end: number;
}

/** Every task's span, by section and place in it, and the instants they cover between them. */
export interface GanttSchedule {
  spans: readonly (readonly GanttSpan[])[];
  domain: readonly [number, number];
}

/** The chart's `dateFormat`, or the default. */
export const dateFormatOf = (data: GanttData): string => data.dateFormat?.trim() || GANTT_DATE_FORMAT;

const dayOf = (t: number) => Math.floor(t / DAY);

/** Whether the day `t` falls on is one `excludes` names. With every weekday excluded, none is. */
export function excludedDays(data: GanttData): (t: number) => boolean {
  const format = dateFormatOf(data);
  const weekdays = new Set<number>();
  const dates = new Set<number>();
  for (const raw of data.excludes ?? []) {
    const word = raw.trim().toLowerCase();
    if (word === 'weekends') {
      weekdays.add(0);
      weekdays.add(6);
    } else if (WEEKDAYS.includes(word)) {
      weekdays.add(WEEKDAYS.indexOf(word));
    } else {
      const t = parseGanttDate(raw, format);
      if (t !== null) dates.add(dayOf(t));
    }
  }
  if (weekdays.size === 7) return () => false;
  return (t) => weekdays.has(new Date(t).getUTCDay()) || dates.has(dayOf(t));
}

function addMonths(t: number, months: number): number {
  const whole = Math.trunc(months);
  const d = new Date(t);
  d.setUTCMonth(d.getUTCMonth() + whole);
  return d.getTime() + (months - whole) * 30 * DAY;
}

/** Where a task of `amount` `unit`s from `start` ends. Days and weeks count only days not `excluded`. */
export function addGanttDuration(start: number, amount: number, unit: GanttUnit, excluded: (t: number) => boolean): number {
  const n = Number.isFinite(amount) ? amount : 0;
  const fixed = FIXED[unit];
  if (fixed !== undefined) return start + n * fixed;
  if (unit === 'M' || unit === 'y') return addMonths(start, unit === 'y' ? n * 12 : n);
  const days = unit === 'w' ? n * 7 : n;
  let end = start + days * DAY;
  if (days > WALK_LIMIT) return end;
  for (let t = start; t < end; t += DAY) if (excluded(t)) end += DAY;
  return end;
}

/** How many whole `unit`s run from `start` to `end`, counted as {@link addGanttDuration} counts them. */
export function ganttDurationBetween(start: number, end: number, unit: GanttUnit, excluded: (t: number) => boolean): number {
  const fixed = FIXED[unit];
  if (fixed !== undefined) return Math.round((end - start) / fixed);
  if (unit === 'M' || unit === 'y') return Math.round((end - start) / ((unit === 'y' ? 365.25 : 30.44) * DAY));
  const steps = Math.min(WALK_LIMIT, Math.round((end - start) / DAY));
  let days = 0;
  for (let k = 0; k < steps; k++) if (!excluded(start + k * DAY)) days++;
  return unit === 'w' ? Math.round(days / 7) : days;
}

/** Each task with where it sits, in document order. */
export function ganttTasks(data: GanttData): { task: GanttTask; section: number; index: number }[] {
  return data.sections.flatMap((s, section) => s.tasks.map((task, index) => ({ task, section, index })));
}

/**
 * Every task's span. A date that does not read in the `dateFormat`, an id no task holds, and the far end of a
 * dependency cycle all resolve to the chart's first date: its earliest written start, else the start of `today`'s
 * day. An end before its start is moved up to the start.
 */
export function scheduleGantt(data: GanttData, today = Date.now()): GanttSchedule {
  const format = dateFormatOf(data);
  const excluded = excludedDays(data);
  const flat = ganttTasks(data);
  const byId = new Map<string, number>();
  flat.forEach(({ task }, i) => {
    if (task.id !== undefined && !byId.has(task.id)) byId.set(task.id, i);
  });
  const written = flat.flatMap(({ task }) => (task.start.kind === 'date' ? [parseGanttDate(task.start.date, format)] : []))
    .filter((t): t is number => t !== null);
  const first = written.length > 0 ? Math.min(...written) : dayOf(today) * DAY;
  const starts: number[] = [];
  const ends: number[] = [];
  const busy = new Set<string>();
  const memo = (cache: number[], i: number, tag: string, compute: () => number): number => {
    if (cache[i] !== undefined) return cache[i]!;
    if (busy.has(tag + i)) return first;
    busy.add(tag + i);
    const value = compute();
    busy.delete(tag + i);
    cache[i] = value;
    return value;
  };
  const named = (ids: readonly string[], of: (i: number) => number) => ids.map((id) => (byId.has(id) ? of(byId.get(id)!) : first));
  const startOf = (i: number): number => memo(starts, i, 's', () => {
    const start = flat[i]!.task.start;
    if (start.kind === 'date') return parseGanttDate(start.date, format) ?? first;
    if (start.kind === 'previous') return i === 0 ? first : endOf(i - 1);
    const after = named(start.ids, endOf);
    return after.length > 0 ? Math.max(...after) : first;
  });
  const endOf = (i: number): number => memo(ends, i, 'e', () => {
    const start = startOf(i);
    const end = flat[i]!.task.end;
    let at: number;
    if (end.kind === 'date') at = parseGanttDate(end.date, format) ?? start;
    else if (end.kind === 'duration') at = addGanttDuration(start, end.amount, end.unit, excluded);
    else {
      const until = named(end.ids, startOf);
      at = until.length > 0 ? Math.min(...until) : start;
    }
    return Math.max(start, at);
  });
  flat.forEach((_, i) => endOf(i));
  const spans = data.sections.map(() => [] as GanttSpan[]);
  // A task inside a cycle may cache its end before its own start settles.
  flat.forEach(({ section }, i) => spans[section]!.push({ start: starts[i]!, end: Math.max(starts[i]!, ends[i]!) }));
  const all = spans.flat();
  const lo = all.length > 0 ? Math.min(...all.map((s) => s.start)) : first;
  const hi = all.length > 0 ? Math.max(...all.map((s) => s.end)) : first;
  return { spans, domain: [lo, hi > lo ? hi : lo + DAY] };
}
