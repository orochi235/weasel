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
    const years = 10 ** Math.floor(Math.log10(target / (12 * MONTH_MS)));
    return { months: 12 * years, unit: 'year' };
  }
  return best;
}

/** Every instant on `interval`'s grid from `lo` to `hi`. */
function gridTicks(lo: number, hi: number, interval: Interval): number[] {
  const out: number[] = [];
  if (interval.ms !== undefined) {
    for (let t = Math.ceil(lo / interval.ms) * interval.ms; t <= hi; t += interval.ms) out.push(t);
    return out;
  }
  const at = new Date(lo);
  let month = at.getUTCFullYear() * 12 + at.getUTCMonth();
  month = Math.ceil(month / interval.months) * interval.months;
  for (;; month += interval.months) {
    const t = Date.UTC(Math.floor(month / 12), month % 12, 1);
    if (t < lo) continue;
    if (t > hi) break;
    out.push(t);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `t` written to the precision of `unit`. */
export function formatInstant(t: number, unit: Unit): string {
  const d = new Date(t);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  switch (unit) {
    case 'year': return String(d.getUTCFullYear());
    case 'month': return date.slice(0, 7);
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
  const map = (v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
  const interval = (count = 5) => intervalFor(Math.abs(span), count);
  return {
    kind: 'time',
    domain: [d0, d1],
    range: [r0, r1],
    map,
    position: map,
    invert: (at) => (r1 === r0 ? d0 : d0 + ((at - r0) / (r1 - r0)) * span),
    ticks: (count = 5) => {
      const out = gridTicks(Math.min(d0, d1), Math.max(d0, d1), interval(count));
      return d0 <= d1 ? out : out.reverse();
    },
    format: (v) => formatInstant(v, interval().unit),
  };
}
