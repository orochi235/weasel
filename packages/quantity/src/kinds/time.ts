import type { DisplayKind, Part } from '../kind';
import type { Unit } from '../units';

/** Seconds in one of each time unit a value can be tagged with, by name and by symbol. */
const SECONDS: Readonly<Record<string, number>> = {
  ms: 0.001, millisecond: 0.001,
  s: 1, second: 1,
  min: 60, minute: 60,
  h: 3600, hour: 3600,
  d: 86400, day: 86400,
};

/** Seconds in one `unit`: a value tagged `ms` counts thousandths. Untagged, or in a unit that is not a time, 1. */
export function secondsPer(unit: Unit | undefined): number {
  return (unit === undefined ? undefined : SECONDS[unit]) ?? 1;
}

/**
 * A point in time, shown as a date and time: `Nov 26, 2026, 2:32 PM`, `14:32`,
 * `2026-11-26 14:32`. A time is an offset from an origin, so its value is a
 * span in the same space as {@link DurationDisplay}'s: seconds, or the time unit
 * the value is tagged with, counted from `origin`. An instant plus a duration
 * is an instant, and two instants apart are a duration, by plain arithmetic.
 */
export type InstantDisplay = {
  kind: 'instant';
  /** Which fields show, as `Intl.DateTimeFormat` takes them: `{ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }`.
   *  Default `{ dateStyle: 'medium', timeStyle: 'short' }`. Ignored with `iso`. */
  fields?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>;
  /** Written as ISO 8601 with a space, to the date, the minute or the second: `2026-11-26 14:32`. */
  iso?: 'date' | 'minute' | 'second';
  /** IANA time zone. Default the viewer's. */
  timeZone?: string;
  /** Where the value counts from, in Unix epoch milliseconds. Default 0, the epoch itself. */
  origin?: number;
};

/** An {@link InstantDisplay}. */
export function instant(options: Omit<InstantDisplay, 'kind'> = {}): InstantDisplay {
  return { kind: 'instant', ...options };
}

const DEFAULT_FIELDS: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
const ISO_FIELDS: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
};

function epochMs(value: number, d: InstantDisplay, unit: Unit | undefined): number {
  return (d.origin ?? 0) + value * secondsPer(unit) * 1000;
}

function isoParts(ms: number, d: InstantDisplay): Part[] {
  const got: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', { ...ISO_FIELDS, timeZone: d.timeZone }).formatToParts(ms)) got[p.type] = p.value;
  const lit = (value: string): Part => ({ type: 'literal', value });
  const parts: Part[] = [
    { type: 'year', value: got['year']! }, lit('-'), { type: 'month', value: got['month']! }, lit('-'), { type: 'day', value: got['day']! },
  ];
  if (d.iso === 'date') return parts;
  parts.push(lit(' '), { type: 'hour', value: got['hour']! }, lit(':'), { type: 'minute', value: got['minute']! });
  if (d.iso === 'second') parts.push(lit(':'), { type: 'second', value: got['second']! });
  return parts;
}

/** The built-in `instant` kind, to spread into a `registerDisplayKind` replacement. */
export const instantKind: DisplayKind<InstantDisplay> = {
  kind: 'instant',
  format: (value, d, ctx) => {
    const ms = epochMs(value, d, ctx.unit);
    if (!Number.isFinite(ms)) return [{ type: 'number', value: String(value) }];
    if (d.iso !== undefined) return isoParts(ms, d);
    const f = new Intl.DateTimeFormat(ctx.locale, { ...(d.fields ?? DEFAULT_FIELDS), timeZone: d.timeZone });
    return f.formatToParts(ms).map((p) => ({ type: p.type, value: p.value }));
  },
  // What `Date` reads: ISO 8601, and the forms the engine's own `toString` writes.
  parse: (text, d, ctx) => (Date.parse(text.trim()) - (d.origin ?? 0)) / 1000 / secondsPer(ctx.unit),
};

/** The units a {@link RelativeDisplay} counts in, smallest first. */
export type RelativeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

const RELATIVE_UNITS: readonly RelativeUnit[] = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];
// A month and a year are the Gregorian averages, so a count of them neither drifts nor jumps a leap day.
const UNIT_SECONDS: Readonly<Record<RelativeUnit, number>> = {
  second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629746, year: 31556952,
};
const DEFAULT_THRESHOLDS: Readonly<Record<RelativeUnit, number>> = {
  second: 60, minute: 60, hour: 24, day: 7, week: 5, month: 12, year: Infinity,
};

/**
 * A time read against now: `3 min. ago`, `in 2 hr.`. Its value is the time's
 * offset from now, in seconds or the time unit it is tagged with: negative is
 * past, as `Intl.RelativeTimeFormat` counts. So it moves as now does, at a rate
 * of −1 second per second, and a live readout of it is the offset when it was
 * taken read on at that rate. Counted in the largest unit whose count stays
 * under its threshold, and truncated: 3 min 59 s is `3 min. ago`. Typed text
 * does not read back.
 */
export type RelativeDisplay = {
  kind: 'relative';
  /** Default `'short'`. */
  style?: Intl.RelativeTimeFormatStyle;
  /** `'auto'` writes `now`, `yesterday`, `next week` where the locale has a word. Default `'always'`. */
  numeric?: Intl.RelativeTimeFormatNumeric;
  /** How many of each unit show before the next unit up takes over. Default 60 s, 60 min, 24 h, 7 d, 5 wk, 12 mo. */
  thresholds?: Partial<Record<RelativeUnit, number>>;
  /** The smallest unit counted. Default `'second'`. */
  smallest?: RelativeUnit;
};

/** A {@link RelativeDisplay}. */
export function relative(options: Omit<RelativeDisplay, 'kind'> = {}): RelativeDisplay {
  return { kind: 'relative', ...options };
}

interface Counted {
  unit: RelativeUnit;
  count: number;
  /** Where the unit below would take over, in seconds from now; 0 at the smallest. */
  floor: number;
}

/** The unit and whole count `seconds` (unsigned) shows in under `d`. */
function counted(seconds: number, d: RelativeDisplay): Counted {
  const units = RELATIVE_UNITS.slice(RELATIVE_UNITS.indexOf(d.smallest ?? 'second'));
  let floor = 0;
  for (const [i, unit] of units.entries()) {
    const count = Math.trunc(seconds / UNIT_SECONDS[unit]);
    const limit = d.thresholds?.[unit] ?? DEFAULT_THRESHOLDS[unit];
    if (count < limit || i === units.length - 1) return { unit, count, floor };
    floor = limit * UNIT_SECONDS[unit];
  }
  throw new Error('unreachable');
}

function relativeParts(value: number, d: RelativeDisplay, locale: string, unit: Unit | undefined, style?: Intl.RelativeTimeFormatStyle): Part[] {
  const seconds = value * secondsPer(unit);
  if (!Number.isFinite(seconds)) return [{ type: 'number', value: String(value) }];
  const { unit: shown, count } = counted(Math.abs(seconds), d);
  const f = new Intl.RelativeTimeFormat(locale, { style: style ?? d.style ?? 'short', numeric: d.numeric ?? 'always' });
  // −0 for a past time under one unit, so it reads `0 sec. ago` rather than `in 0 sec.`.
  return f.formatToParts(seconds < 0 ? -count : count, shown).map((p) =>
    p.type === 'literal' ? { type: 'literal', value: p.value } : { type: 'number', value: p.value });
}

/** A hair past a boundary, in seconds: a wake there finds the text already changed. */
const PAST = 1e-3;

/** The built-in `relative` kind, to spread into a `registerDisplayKind` replacement. */
export const relativeKind: DisplayKind<RelativeDisplay> = {
  kind: 'relative',
  format: (value, d, ctx) => relativeParts(value, d, ctx.locale, ctx.unit),
  speak: (value, d, ctx) => relativeParts(value, d, ctx.locale, ctx.unit, 'long').map((p) => p.value).join(''),
  parse: () => NaN,
  nextChange: (value, rate, d, ctx) => {
    const per = secondsPer(ctx.unit);
    const seconds = value * per;
    const speed = Math.abs(rate) * per;
    if (speed === 0 || !Number.isFinite(seconds)) return Infinity;
    const away = Math.abs(seconds);
    const c = counted(away, d);
    const step = UNIT_SECONDS[c.unit];
    // Moving away from now, the count next rises a whole unit; toward it, it falls at the larger of its own
    // floor and where the unit below takes over, and at now itself the sign turns.
    const receding = seconds === 0 ? true : Math.sign(seconds) === Math.sign(rate);
    const span = receding ? (c.count + 1) * step - away : away - Math.max(c.count * step, c.floor) + PAST;
    return span / speed;
  },
};
