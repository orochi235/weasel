import { replacedFormat } from './replacedFormat';
import { formatTick } from './tickFormat';
import type { ContinuousScale } from './types';

/** Options for {@link linearScale}. */
export interface LinearScaleOptions {
  domain: readonly [number, number];
  range: readonly [number, number];
  /** Widen the domain out to whole tick steps for about this many ticks. Default no widening. */
  nice?: number;
}

/** Options for {@link LinearScale.spacedTicks}. */
export interface SpacedTickOptions {
  /** Smallest gap between neighboring ticks, in range units (px, for a scale onto the screen). */
  minSpacing: number;
  /** Ticks closer than this to either end of the range are dropped, in range units. Default 0. */
  inset?: number;
}

/** A column of ticks and the facts its labels share. */
export interface TickSet {
  /** Ascending, whichever way the domain runs. */
  values: number[];
  /** Distance between neighboring ticks. */
  step: number;
  /** Places after the point every label in the column shares. */
  decimals: number;
}

/** A scale that maps numbers proportionally, as a value axis does. */
export interface LinearScale extends ContinuousScale {
  readonly kind: 'linear';
  /** The distance between ticks when about `count` are asked for. */
  tickStep(count?: number): number;
  /** Ticks on the finest 1/2/5 step that keeps neighbors `minSpacing` apart along the range, so a longer axis
   *  gets more of them. Empty for an empty domain or range. */
  spacedTicks(options: SpacedTickOptions): TickSet;
  tickFormat(count?: number): (value: number) => string;
}

const DEFAULT_TICKS = 5;

/** The round step, 1, 2 or 5 times a power of ten, that cuts `lo`..`hi` into about `count` pieces. */
export function tickStep(lo: number, hi: number, count = DEFAULT_TICKS): number {
  // Halved first, so ends near ±Number.MAX_VALUE still give a step rather than an infinite span.
  const raw = (Math.abs(hi / 2 - lo / 2) / Math.max(1, count)) * 2;
  if (!Number.isFinite(raw)) return 1;
  // A span among the subnormals halves to nothing, and is cut at multiples of itself.
  if (raw === 0) return Math.abs(hi - lo) || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  // Rounded up past the largest double, the step falls back to its power of ten.
  return Number.isFinite(factor * power) ? factor * power : power;
}

/** The most `toFixed` accepts. */
const MAX_DECIMALS = 100;

/** How many decimals a value on a grid of `step` needs; 0 for a step that is not a positive number. */
export function decimalsOf(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  return Math.min(MAX_DECIMALS, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
}

/** The smallest of 1, 2 or 5 times a power of ten that is at least `rough`. Unlike {@link tickStep}, which
 *  rounds to the nearest, this never goes under: a minimum spacing stays a minimum. */
export function niceStep(rough: number): number {
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

/** Whether `i++` from `i` moves, so a loop over step indices ends. */
const countable = (i: number): boolean => Math.abs(i) <= Number.MAX_SAFE_INTEGER;

/** The smallest step whose places `toFixed` can write. */
const FINEST = 10 ** -MAX_DECIMALS;

/** `i` steps of `step`, without the float noise a bare product carries. */
const onGrid = (i: number, step: number): number => (step < FINEST ? i * step + 0 : Number((i * step).toFixed(decimalsOf(step))));

/** Every multiple of `step` from `lo` to `hi`, inclusive; none where those multiples are past counting. */
export function stepTicks(lo: number, hi: number, step: number): number[] {
  const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
  const first = Math.ceil(a / step - 1e-9);
  const last = Math.floor(b / step + 1e-9);
  if (!countable(first) || !countable(last)) return [];
  const out: number[] = [];
  for (let i = first; i <= last; i++) out.push(onGrid(i, step));
  return lo <= hi ? out : out.reverse();
}

/** Ticks across `domain`, laid `length` range units long; see {@link LinearScale.spacedTicks}. */
function spacedTicks(domain: readonly [number, number], length: number, options: SpacedTickOptions): TickSet {
  const lo = Math.min(domain[0], domain[1]);
  const hi = Math.max(domain[0], domain[1]);
  const span = hi - lo;
  const { minSpacing, inset = 0 } = options;
  if (!(span > 0) || !Number.isFinite(span) || !(length > 0) || !(minSpacing > 0)) return { values: [], step: 0, decimals: 0 };
  const perUnit = span / length;
  const step = niceStep(minSpacing * perUnit);
  const decimals = decimalsOf(step);
  const first = Math.ceil((lo + inset * perUnit) / step - 1e-9);
  const last = Math.floor((hi - inset * perUnit) / step + 1e-9);
  if (!countable(first) || !countable(last)) return { values: [], step, decimals };
  const values: number[] = [];
  for (let i = first; i <= last; i++) values.push(onGrid(i, step) + 0);
  return { values, step, decimals };
}

/** `value` written as plainly as a grid of `step` allows: no trailing zeros, and no exponent above 1e-100. */
export function formatNumber(value: number, step: number): string {
  // Past the places `toFixed` writes, a label takes the exponent rather than reading 0.
  if ((step > 0 && step < FINEST) || (value !== 0 && Math.abs(value) < FINEST)) return String(Number(value.toPrecision(12)));
  const decimals = decimalsOf(step);
  const fixed = formatTick(value, { decimals, step });
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** `domain` widened to whole steps of a tick grid of about `count` ticks. */
export function niceDomain(domain: readonly [number, number], count = DEFAULT_TICKS): [number, number] {
  const [lo, hi] = domain;
  if (lo === hi) return lo === 0 ? [0, 1] : [Math.min(0, lo), Math.max(0, hi)];
  const step = tickStep(lo, hi, count);
  const down = (v: number) => onGrid(Math.floor(v / step + 1e-9), step);
  const up = (v: number) => onGrid(Math.ceil(v / step - 1e-9), step);
  // An end whose whole step overflows stays where it is, and so does a span too fine for its step to cut.
  const [a, b] = lo < hi ? [down(lo), up(hi)] : [up(lo), down(hi)];
  const out: [number, number] = [Number.isFinite(a) ? a : lo, Number.isFinite(b) ? b : hi];
  return out[0] === out[1] ? [lo, hi] : out;
}

/** How far `v` lies from `d0` toward `d1`, as a share of the span, and back. A distance past the double range is
 *  taken in halves, which do not overflow. */
export function proportion(d0: number, d1: number): { along(v: number): number; unmap(t: number): number } {
  const span = d1 - d0;
  const half = d1 / 2 - d0 / 2;
  const wide = !Number.isFinite(span) && Number.isFinite(half);
  // Halves where a difference overflows; not where they underflow to nothing, as a subnormal span's do.
  return {
    along(v) {
      const t = (v - d0) / span;
      return !wide && (Number.isFinite(t) || !Number.isFinite(v) || half === 0) ? t : (v / 2 - d0 / 2) / half;
    },
    unmap(t) {
      if (t === 0 || t === 1) return t === 0 ? d0 : d1;
      const v = d0 + t * span;
      if (!wide && (Number.isFinite(v) || !Number.isFinite(t) || half === 0)) return v;
      const w = 2 * (d0 / 2 + t * half);
      // Doubled back near an end of the double range, a point inside the domain can round past it.
      return t > 0 && t < 1 ? Math.min(Math.max(d0, d1), Math.max(Math.min(d0, d1), w)) : w;
    },
  };
}

/** A linear scale from `domain` onto `range`. */
export function linearScale(opts: LinearScaleOptions): LinearScale {
  const domain = opts.nice !== undefined ? niceDomain(opts.domain, opts.nice) : ([opts.domain[0], opts.domain[1]] as const);
  const range = [opts.range[0], opts.range[1]] as const;
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const { along, unmap } = proportion(d0, d1);
  const map = (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + along(v) * (r1 - r0));
  const step = (count = DEFAULT_TICKS) => tickStep(d0, d1, count);
  const format = (v: number): string => formatNumber(v, step());
  return {
    kind: 'linear',
    domain,
    range,
    map,
    position: map,
    invert: (at) => (r1 === r0 ? d0 : unmap((at - r0) / (r1 - r0))),
    tickStep: step,
    spacedTicks: (options) => spacedTicks(domain, Math.abs(r1 - r0), options),
    ticks: (count = DEFAULT_TICKS) => stepTicks(d0, d1, step(count)),
    format,
    tickFormat(count) {
      const s = step(count);
      return replacedFormat(this, format) ?? ((v) => formatNumber(v, s));
    },
  };
}
