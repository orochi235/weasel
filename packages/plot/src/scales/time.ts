import { proportion, tickStep } from './linear';
import { replacedFormat } from './replacedFormat';
import type { ContinuousScale } from './types';

/** Options for {@link timeScale}. */
export interface TimeScaleOptions {
  /** Milliseconds since the epoch, as `Date.getTime` gives them. */
  domain: readonly [number, number];
  range: readonly [number, number];
}

/** A scale over instants, whose ticks fall on whole seconds, minutes, hours, days, months or years, in UTC. */
export interface TimeScale extends ContinuousScale {
  readonly kind: 'time';
  tickFormat(count?: number): (value: number) => string;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A tick interval: a fixed span, or a count of calendar months. */
type Interval = { ms: number; months?: never; unit: Unit } | { months: number; ms?: never; unit: Unit };
type Unit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

const INTERVALS: readonly Interval[] = [
  { ms: SECOND, unit: 'second' }, { ms: 5 * SECOND, unit: 'second' }, { ms: 15 * SECOND, unit: 'second' }, { ms: 30 * SECOND, unit: 'second' },
  { ms: MINUTE, unit: 'minute' }, { ms: 5 * MINUTE, unit: 'minute' }, { ms: 15 * MINUTE, unit: 'minute' }, { ms: 30 * MINUTE, unit: 'minute' },
  { ms: HOUR, unit: 'hour' }, { ms: 3 * HOUR, unit: 'hour' }, { ms: 6 * HOUR, unit: 'hour' }, { ms: 12 * HOUR, unit: 'hour' },
  { ms: DAY, unit: 'day' }, { ms: 2 * DAY, unit: 'day' }, { ms: 7 * DAY, unit: 'day' },
  { months: 1, unit: 'month' }, { months: 3, unit: 'month' }, { months: 12, unit: 'year' },
];

const MONTH_MS = 30 * DAY;
const spanOf = (i: Interval): number => i.ms ?? i.months * MONTH_MS;

/** The interval nearest a cut of `span` into `count` pieces; whole years past the table's end. */
function intervalFor(span: number, count: number): Interval {
  const target = span / Math.max(1, count);
  let best = INTERVALS[0]!;
  for (const i of INTERVALS) if (Math.abs(Math.log(spanOf(i) / target)) < Math.abs(Math.log(spanOf(best) / target))) best = i;
  if (best.unit === 'year' && target > 12 * MONTH_MS) {
    return { months: 12 * tickStep(0, target / (12 * MONTH_MS), 1), unit: 'year' };
  }
  return best;
}

/** The first instant of month `month`, counted from January of year 0. `Date.UTC` would read years 0 to 99 as
 *  1900 to 1999. */
function monthStart(month: number): number {
  const at = new Date(0);
  at.setUTCFullYear(Math.floor(month / 12), ((month % 12) + 12) % 12, 1);
  return at.getTime();
}

/** The furthest instant from the epoch a `Date` holds, either way. */
const MAX_INSTANT = 8.64e15;

/** Every instant on `interval`'s grid from `lo` to `hi`, within what a `Date` holds. */
function gridTicks(lo: number, hi: number, interval: Interval): number[] {
  const out: number[] = [];
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return out;
  lo = Math.max(lo, -MAX_INSTANT);
  hi = Math.min(hi, MAX_INSTANT);
  if (lo > hi) return out;
  if (interval.ms !== undefined) {
    for (let t = Math.ceil(lo / interval.ms) * interval.ms; t <= hi; t += interval.ms) out.push(t);
    return out;
  }
  const at = new Date(lo);
  let month = at.getUTCFullYear() * 12 + at.getUTCMonth();
  month = Math.ceil(month / interval.months) * interval.months;
  for (;; month += interval.months) {
    const t = monthStart(month);
    // NaN past the last month a Date holds.
    if (!(t <= hi)) break;
    if (t < lo) continue;
    out.push(t);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `t` written to the precision of `unit`. */
export function formatInstant(t: number, unit: Unit): string {
  const d = new Date(t);
  const month = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  const date = `${month}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  switch (unit) {
    case 'year': return String(d.getUTCFullYear());
    case 'month': return month;
    case 'day': return date;
    case 'hour':
    case 'minute': return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? date : time;
    case 'second': return `${time}:${pad(d.getUTCSeconds())}`;
  }
}

/** A time scale from `domain`, in milliseconds since the epoch, onto `range`. */
export function timeScale(opts: TimeScaleOptions): TimeScale {
  const [d0, d1] = opts.domain;
  const [r0, r1] = opts.range;
  const span = d1 - d0;
  const { along, unmap } = proportion(d0, d1);
  const map = (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + along(v) * (r1 - r0));
  const interval = (count = 5) => intervalFor(Math.abs(span), count);
  const format = (v: number): string => formatInstant(v, interval().unit);
  return {
    kind: 'time',
    domain: [d0, d1],
    range: [r0, r1],
    map,
    position: map,
    invert: (at) => (r1 === r0 ? d0 : unmap((at - r0) / (r1 - r0))),
    ticks: (count = 5) => {
      const out = gridTicks(Math.min(d0, d1), Math.max(d0, d1), interval(count));
      return d0 <= d1 ? out : out.reverse();
    },
    format,
    tickFormat(count) {
      const { unit } = interval(count);
      return replacedFormat(this, format) ?? ((v) => formatInstant(v, unit));
    },
  };
}
