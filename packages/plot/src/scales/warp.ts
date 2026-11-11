import { formatNumber, proportion, stepTicks, tickStep } from './linear';
import { replacedFormat } from './replacedFormat';
import type { ContinuousScale } from './types';

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

/** A scale from `domain` onto `range`, linear in `to(value)` and inverted through `from`. Ticks and labels are a
 *  linear scale's over the same domain, in the value's own units. */
export function warpScale(opts: WarpScaleOptions): WarpScale {
  const { to, from } = opts;
  const [d0, d1] = opts.domain;
  const [r0, r1] = opts.range;
  const w0 = to(d0);
  const w1 = to(d1);
  const { along, unmap } = proportion(w0, w1);
  const map = (v: number) => (w1 === w0 ? (r0 + r1) / 2 : r0 + along(to(v)) * (r1 - r0));
  const step = (count = DEFAULT_TICKS) => tickStep(d0, d1, count);
  const format = (v: number): string => formatNumber(v, step());
  return {
    kind: 'warp',
    domain: [d0, d1],
    range: [r0, r1],
    map,
    position: map,
    invert: (at) => (r1 === r0 ? d0 : from(unmap((at - r0) / (r1 - r0)))),
    ticks: (count = DEFAULT_TICKS) => stepTicks(d0, d1, step(count)),
    format,
    tickFormat(count) {
      const s = step(count);
      return replacedFormat(this, format) ?? ((v) => formatNumber(v, s));
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
