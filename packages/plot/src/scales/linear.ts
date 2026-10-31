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
}

const DEFAULT_TICKS = 5;

/** The round step, 1, 2 or 5 times a power of ten, that cuts `lo`..`hi` into about `count` pieces. */
export function tickStep(lo: number, hi: number, count = DEFAULT_TICKS): number {
  const span = Math.abs(hi - lo);
  if (span === 0 || !Number.isFinite(span)) return 1;
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  return factor * power;
}

const MAX_DECIMALS = 20;

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

/** `i` steps of `step`, without the float noise a bare product carries. */
const onGrid = (i: number, step: number): number => Number((i * step).toFixed(decimalsOf(step)));

/** Every multiple of `step` from `lo` to `hi`, inclusive. */
export function stepTicks(lo: number, hi: number, step: number): number[] {
  const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
  const out: number[] = [];
  for (let i = Math.ceil(a / step - 1e-9); i <= Math.floor(b / step + 1e-9); i++) out.push(onGrid(i, step));
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
  const values: number[] = [];
  for (let i = first; i <= last; i++) values.push(onGrid(i, step) + 0);
  return { values, step, decimals };
}

/** `value` written as plainly as a grid of `step` allows: no trailing zeros, no exponent. */
export function formatNumber(value: number, step: number): string {
  const fixed = value.toFixed(Math.min(20, decimalsOf(step)));
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** `domain` widened to whole steps of a tick grid of about `count` ticks. */
export function niceDomain(domain: readonly [number, number], count = DEFAULT_TICKS): [number, number] {
  const [lo, hi] = domain;
  if (lo === hi) return lo === 0 ? [0, 1] : [Math.min(0, lo), Math.max(0, hi)];
  const step = tickStep(lo, hi, count);
  const down = (v: number) => onGrid(Math.floor(v / step + 1e-9), step);
  const up = (v: number) => onGrid(Math.ceil(v / step - 1e-9), step);
  return lo < hi ? [down(lo), up(hi)] : [up(lo), down(hi)];
}

/** A linear scale from `domain` onto `range`. */
export function linearScale(opts: LinearScaleOptions): LinearScale {
  const domain = opts.nice !== undefined ? niceDomain(opts.domain, opts.nice) : ([opts.domain[0], opts.domain[1]] as const);
  const range = [opts.range[0], opts.range[1]] as const;
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const map = (v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
  const step = (count = DEFAULT_TICKS) => tickStep(d0, d1, count);
  return {
    kind: 'linear',
    domain,
    range,
    map,
    position: map,
    invert: (at) => (r1 === r0 ? d0 : d0 + ((at - r0) / (r1 - r0)) * span),
    tickStep: step,
    spacedTicks: (options) => spacedTicks(domain, Math.abs(r1 - r0), options),
    ticks: (count = DEFAULT_TICKS) => stepTicks(d0, d1, step(count)),
    format: (v) => formatNumber(v, step()),
  };
}
