import { formatNumber } from './linear';
import type { ContinuousScale } from './types';

/** Options for {@link logScale}. */
export interface LogScaleOptions {
  /** Both ends above zero. */
  domain: readonly [number, number];
  range: readonly [number, number];
  /** Default 10. */
  base?: number;
}

/** A scale that maps the logarithm of a value proportionally. */
export interface LogScale extends ContinuousScale {
  readonly kind: 'log';
  readonly base: number;
}

/** A logarithmic scale from `domain`, whose ends must both be above zero, onto `range`. */
export function logScale(opts: LogScaleOptions): LogScale {
  const base = opts.base ?? 10;
  const [d0, d1] = opts.domain;
  if (!(d0 > 0 && d1 > 0)) throw new Error(`logScale: a domain of ${d0}..${d1} does not lie above zero`);
  const [r0, r1] = opts.range;
  const log = (v: number) => Math.log(v) / Math.log(base);
  const l0 = log(d0);
  const l1 = log(d1);
  const map = (v: number) => (l1 === l0 ? (r0 + r1) / 2 : r0 + ((log(v) - l0) / (l1 - l0)) * (r1 - r0));
  const ticks = (count = 5): number[] => {
    const [lo, hi] = l0 <= l1 ? [l0, l1] : [l1, l0];
    const first = Math.floor(lo + 1e-9);
    const last = Math.ceil(hi - 1e-9);
    // Few decades get their 2s and 5s too, so a short axis still reads.
    const steps = last - first < count / 2 && base === 10 ? [1, 2, 5] : [1];
    const out: number[] = [];
    for (let p = first; p <= last; p++) {
      for (const m of steps) {
        const v = Number((m * base ** p).toPrecision(12));
        if (log(v) >= lo - 1e-9 && log(v) <= hi + 1e-9) out.push(v);
      }
    }
    return l0 <= l1 ? out : out.reverse();
  };
  return {
    kind: 'log',
    base,
    domain: [d0, d1],
    range: [r0, r1],
    map,
    position: map,
    invert: (at) => base ** (r1 === r0 ? l0 : l0 + ((at - r0) / (r1 - r0)) * (l1 - l0)),
    ticks,
    format: (v) => (v >= 1 ? formatNumber(v, 1) : formatNumber(v, 10 ** Math.floor(Math.log10(v)))),
  };
}
