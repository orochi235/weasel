import { formatNumber, proportion, stepTicks, tickStep } from './linear';
import { replacedFormat } from './replacedFormat';
import type { ContinuousScale } from './types';
import { lerp } from '@weasel-js/geom';

/** Options for {@link warpScale}. */
export interface WarpScaleOptions {
  domain: readonly [number, number];
  range: readonly [number, number];
  /** The warped value the scale is linear in. Must increase or decrease across the whole domain. */
  to: (value: number) => number;
  /** The inverse of `to`. */
  from: (warped: number) => number;
}

/** A scale that maps `to(value)` proportionally. */
export interface WarpScale extends ContinuousScale {
  readonly kind: 'warp' | 'pow';
  tickFormat(count?: number): (value: number) => string;
}

const DEFAULT_TICKS = 5;

/** Round values: 1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten. Fewer leave two neighbors bunched where an even
 *  place falls between them, as 20 and 25 did on a square-root axis to 100. */
const MANTISSAS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

/** `m` times `p` without the float noise a bare product carries. */
const times = (m: number, p: number) => Number((m * p).toPrecision(12));

/**
 * The round value inside `lo`..`hi` nearest `v` along a scale warped by `to`, not one already `taken`, and a whole
 * number where `whole`; null for none there.
 */
function roundNear(v: number, to: (value: number) => number, lo: number, hi: number, whole: boolean, taken: readonly number[]): number | null {
  if (v === 0) return lo <= 0 && hi >= 0 && !taken.includes(0) ? 0 : null;
  const p = 10 ** Math.floor(Math.log10(Math.abs(v)));
  const near = MANTISSAS.map((m) => Math.sign(v) * times(m, p))
    .filter((c) => c >= lo && c <= hi && !taken.includes(c) && (!whole || Number.isInteger(c)));
  if (near.length === 0) return null;
  return near.reduce((best, c) => (Math.abs(to(c) - to(v)) < Math.abs(to(best) - to(v)) ? c : best));
}

/**
 * About `count` ticks spaced evenly along a scale warped by `to`, each moved to the round value nearest its place, in
 * the domain's direction: whole numbers only, where the domain holds one for every tick. Evenly spaced values bunch at one end of a warped axis, so the spacing is the warped one.
 */
export function warpTicks(domain: readonly [number, number], to: (value: number) => number, from: (warped: number) => number, count = DEFAULT_TICKS): number[] {
  const [d0, d1] = domain;
  const w0 = to(d0);
  const w1 = to(d1);
  if (w0 === w1 || !Number.isFinite(w0) || !Number.isFinite(w1)) return stepTicks(d0, d1, tickStep(d0, d1, count));
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  const n = Math.max(1, Math.round(count));
  const out: number[] = [];
  // A domain holding a whole number for every tick ticks on whole numbers only.
  const whole = Math.floor(hi) - Math.ceil(lo) + 1 >= n + 1;
  for (let i = 0; i <= n; i++) {
    const tick = roundNear(from(lerp(w0, w1, i / n)), to, lo, hi, whole, out);
    if (tick !== null) out.push(tick);
  }
  return out.sort((a, b) => (d0 <= d1 ? a - b : b - a));
}

/** The grid a round value sits on, so its label keeps the decimals it has: 0.5 for 2.5, 1 for 2. */
function gridOf(v: number): number {
  if (v === 0 || !Number.isFinite(v)) return 1;
  const p = 10 ** Math.floor(Math.log10(Math.abs(v)));
  const m = Math.abs(v) / p;
  return Math.abs(m - Math.round(m)) < 1e-9 ? p : p / 10;
}

/** A scale from `domain` onto `range`, linear in `to(value)` and inverted through `from`. Its ticks are spaced
 *  evenly along the range, on round values in the value's own units ({@link warpTicks}). */
export function warpScale(opts: WarpScaleOptions): WarpScale {
  const { to, from } = opts;
  const [d0, d1] = opts.domain;
  const [r0, r1] = opts.range;
  const w0 = to(d0);
  const w1 = to(d1);
  const { along, unmap } = proportion(w0, w1);
  const map = (v: number) => (w1 === w0 ? (r0 + r1) / 2 : lerp(r0, r1, along(to(v))));
  const step = (count = DEFAULT_TICKS) => tickStep(d0, d1, count);
  const format = (v: number): string => formatNumber(v, step());
  return {
    kind: 'warp',
    domain: [d0, d1],
    range: [r0, r1],
    position: map,
    invert: (at) => (r1 === r0 ? d0 : from(unmap((at - r0) / (r1 - r0)))),
    ticks: (count = DEFAULT_TICKS) => warpTicks([d0, d1], to, from, count),
    format,
    tickFormat() {
      return replacedFormat(this, format) ?? ((v) => formatNumber(v, gridOf(v)));
    },
  };
}

/** Options for {@link powScale}. */
export interface PowScaleOptions {
  domain: readonly [number, number];
  range: readonly [number, number];
  /** Not zero, and positive for a domain reaching zero. 0.5 is a square-root scale. */
  exponent: number;
}

/** A scale that maps a value raised to a power proportionally. */
export interface PowScale extends WarpScale {
  readonly kind: 'pow';
  readonly exponent: number;
}

/** A power scale from `domain` onto `range`: linear in `value ** exponent`, with a negative value keeping its sign,
 *  so a square-root scale (`exponent: 0.5`) takes a domain on either side of zero. */
export function powScale(opts: PowScaleOptions): PowScale {
  const k = opts.exponent;
  if (!(k !== 0 && Number.isFinite(k))) throw new Error(`powScale: an exponent of ${k} does not warp`);
  const [d0, d1] = opts.domain;
  if (k < 0 && !(Math.min(d0, d1) > 0 || Math.max(d0, d1) < 0)) {
    throw new Error(`powScale: an exponent of ${k} sends zero to infinity, and a domain of ${d0}..${d1} reaches it`);
  }
  const raise = (p: number) => (v: number) => Math.sign(v) * Math.abs(v) ** p;
  return { ...warpScale({ domain: opts.domain, range: opts.range, to: raise(k), from: raise(1 / k) }), kind: 'pow', exponent: k };
}
