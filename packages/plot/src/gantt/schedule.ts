/** A gantt's tasks resolved to instants: dependencies followed, durations counted past excluded days. */
import { maxOf, minOf } from '@weasel-js/geom';
import { GANTT_DATE_FORMAT, parseGanttDate } from './dates';
import type { GanttData, GanttTask, GanttUnit } from './types';

/** Milliseconds in a day. */
export const DAY = 86_400_000;
const HOUR = 3_600_000;
const FIXED: Readonly<Partial<Record<GanttUnit, number>>> = { ms: 1, s: 1000, m: 60_000, h: HOUR };
/** Past this many days, a duration is not walked day by day for excluded days. */
const WALK_LIMIT = 100_000;
/** The furthest instant from the epoch a `Date` holds; past it a day neither has a weekday nor moves a float. */
const MAX_INSTANT = 8.64e15;
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

/** `t` moved by `months` calendar months, a day past the target month's last held to it, as Day.js adds months; past
 *  the instants a `Date` holds, by 30 days a month. */
function addMonths(t: number, months: number): number {
  const whole = Math.trunc(months);
  const d = new Date(t);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + whole, 1);
  const last = new Date(d.getTime());
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  d.setUTCDate(Math.min(day, last.getUTCDate()));
  const at = d.getTime() + (months - whole) * 30 * DAY;
  return Number.isNaN(at) ? t + months * 30 * DAY : at;
}

/** Where a task of `amount` `unit`s from `start` ends, held to what a number holds. Days and weeks count only days not
 *  `excluded`. */
export function addGanttDuration(start: number, amount: number, unit: GanttUnit, excluded: (t: number) => boolean): number {
  return Math.min(Number.MAX_VALUE, Math.max(-Number.MAX_VALUE, endAfter(start, amount, unit, excluded)));
}

/** {@link addGanttDuration}'s end before it is held to what a number holds. */
function endAfter(start: number, amount: number, unit: GanttUnit, excluded: (t: number) => boolean): number {
  const n = Number.isFinite(amount) ? amount : 0;
  const fixed = FIXED[unit];
  if (fixed !== undefined) return start + n * fixed;
  if (unit === 'M' || unit === 'y') return addMonths(start, unit === 'y' ? n * 12 : n);
  const days = unit === 'w' ? n * 7 : n;
  let end = start + days * DAY;
  if (days > WALK_LIMIT || !(Math.abs(start) <= MAX_INSTANT)) return end;
  for (let t = start; t < end; t += DAY) if (excluded(t)) end += DAY;
  return end;
}

/** How many whole `unit`s run from `start` to `end`, counted as {@link addGanttDuration} counts them. */
export function ganttDurationBetween(start: number, end: number, unit: GanttUnit, excluded: (t: number) => boolean): number {
  const fixed = FIXED[unit];
  if (fixed !== undefined) return Math.round((end - start) / fixed);
  if (unit === 'M' || unit === 'y') return monthsBetween(start, end, unit === 'y' ? 12 : 1);
  const span = Math.round((end - start) / DAY);
  // endAfter walks only durations up to WALK_LIMIT days, which span at most a week for each.
  let days = span;
  if (span > 0 && span <= 7 * (WALK_LIMIT + 1) && Math.abs(start) <= MAX_INSTANT) {
    let counted = 0;
    for (let k = 0; k < span; k++) if (!excluded(start + k * DAY)) counted++;
    if (counted <= WALK_LIMIT) days = counted;
  }
  return unit === 'w' ? Math.round(days / 7) : days;
}

/** The whole number of `per`-month steps from `start` whose end by {@link addMonths} falls nearest `end`. */
function monthsBetween(start: number, end: number, per: number): number {
  const guess = Math.round((end - start) / (per * 30.44 * DAY));
  let best = guess;
  for (const n of [guess - 1, guess + 1]) {
    if (Math.abs(addMonths(start, n * per) - end) < Math.abs(addMonths(start, best * per) - end)) best = n;
  }
  return best;
}

/**
 * Every node's value, each node's dependencies resolved before it, in the order `depsOf` lists them, from node 0 up. A
 * dependency still being resolved, the far end of a cycle, takes `cycle`. Walked with a stack of its own, so a long
 * chain of dependencies does not overflow the call stack.
 */
function resolveNodes(
  count: number, depsOf: (n: number) => readonly (number | null)[], combine: (n: number, values: readonly number[]) => number,
  cycle: number,
): number[] {
  const values: number[] = new Array(count);
  const busy = new Uint8Array(count);
  const frames: { n: number; deps: readonly (number | null)[]; got: number[] }[] = [];
  const enter = (n: number) => {
    busy[n] = 1;
    frames.push({ n, deps: depsOf(n), got: [] });
  };
  for (let root = 0; root < count; root++) {
    if (values[root] !== undefined) continue;
    enter(root);
    while (frames.length > 0) {
      const f = frames.at(-1)!;
      if (f.got.length < f.deps.length) {
        const d = f.deps[f.got.length]!;
        if (d === null || busy[d] === 1) f.got.push(cycle);
        else if (values[d] !== undefined) f.got.push(values[d]!);
        else enter(d);
        continue;
      }
      const value = combine(f.n, f.got);
      busy[f.n] = 0;
      values[f.n] = value;
      frames.pop();
      frames.at(-1)?.got.push(value);
    }
  }
  return values;
}

/** A day from `t`, or as far as the next double can be where a day is too fine to move it. */
function widened(t: number): [number, number] {
  const by = Math.max(DAY, Math.abs(t) * Number.EPSILON);
  return Number.isFinite(t + by) ? [t, t + by] : [t - by, t];
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
  const first = written.length > 0 ? minOf(written) : dayOf(today) * DAY;
  // Node 2i is task i's start, 2i + 1 its end; `null` stands for `first`.
  const ref = (ids: readonly string[], end: number) => ids.map((id) => (byId.has(id) ? 2 * byId.get(id)! + end : null));
  const depsOf = (n: number): (number | null)[] => {
    const i = Math.floor(n / 2);
    const { start, end } = flat[i]!.task;
    if (n % 2 === 1) return [2 * i, ...(end.kind === 'until' ? ref(end.ids, 0) : [])];
    if (start.kind === 'date') return [];
    if (start.kind === 'previous') return i === 0 ? [null] : [2 * i - 1];
    return ref(start.ids, 1);
  };
  const combine = (n: number, values: readonly number[]): number => {
    const { start, end } = flat[Math.floor(n / 2)]!.task;
    if (n % 2 === 0) {
      if (start.kind === 'date') return parseGanttDate(start.date, format) ?? first;
      return values.length > 0 ? maxOf(values) : first;
    }
    const from = values[0]!;
    let at: number;
    if (end.kind === 'date') at = parseGanttDate(end.date, format) ?? from;
    else if (end.kind === 'duration') at = addGanttDuration(from, end.amount, end.unit, excluded);
    else at = values.length > 1 ? minOf(values.slice(1)) : from;
    return Math.max(from, at);
  };
  const resolved = resolveNodes(flat.length * 2, depsOf, combine, first);
  const starts = resolved.filter((_, n) => n % 2 === 0);
  const ends = resolved.filter((_, n) => n % 2 === 1);
  const spans = data.sections.map(() => [] as GanttSpan[]);
  // A task inside a cycle may cache its end before its own start settles.
  flat.forEach(({ section }, i) => spans[section]!.push({ start: starts[i]!, end: Math.max(starts[i]!, ends[i]!) }));
  const all = spans.flat();
  const lo = all.length > 0 ? minOf(all, (s) => s.start) : first;
  const hi = all.length > 0 ? maxOf(all, (s) => s.end) : first;
  return { spans, domain: hi > lo ? [lo, hi] : widened(lo) };
}
