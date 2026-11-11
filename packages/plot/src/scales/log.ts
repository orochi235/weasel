import { decimalsOf, formatNumber } from './linear';
import { replacedFormat } from './replacedFormat';
import { tickDecimals } from './tickFormat';
import type { ContinuousScale } from './types';

/** Options for {@link logScale}. */
export interface LogScaleOptions {
  /** Both ends above zero. */
  domain: readonly [number, number];
  range: readonly [number, number];
  /** Above zero and not 1. Default 10. */
  base?: number;
}

/** A scale that maps the logarithm of a value proportionally. */
export interface LogScale extends ContinuousScale {
  readonly kind: 'log';
  readonly base: number;
  tickFormat(count?: number): (value: number) => string;
}

/** A logarithmic scale from `domain`, whose ends must both be above zero, onto `range`. */
export function logScale(opts: LogScaleOptions): LogScale {
  const base = opts.base ?? 10;
  if (!(base > 0 && base !== 1 && Number.isFinite(base))) throw new Error(`logScale: a base of ${base} takes no logarithm`);
  const [d0, d1] = opts.domain;
  if (!(d0 > 0 && d1 > 0)) throw new Error(`logScale: a domain of ${d0}..${d1} does not lie above zero`);
  const [r0, r1] = opts.range;
  const log = (v: number) => Math.log(v) / Math.log(base);
  const l0 = log(d0);
  const l1 = log(d1);
  // Ends too near for their logarithms to differ are told apart by their distance, which a ratio rounds away.
  const along = l1 !== l0 ? (v: number) => (log(v) - l0) / (l1 - l0) : (v: number) => Math.log1p((v - d0) / d0) / Math.log1p((d1 - d0) / d0);
  const map = (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + along(v) * (r1 - r0));
  const ticks = (count = 5): number[] => {
    const [lo, hi] = l0 <= l1 ? [l0, l1] : [l1, l0];
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
    const first = Math.floor(lo + 1e-9);
    const last = Math.ceil(hi - 1e-9);
    // Few decades get their 2s and 5s too, so a short axis still reads; many keep every `every`th, about twice the count.
    const steps = last - first < count / 2 && base === 10 ? [1, 2, 5] : [1];
    const every = Math.max(1, Math.ceil((last - first) / (2 * Math.max(1, count))));
    // Compared as values, with room for a tick's rounding but never more than a sliver of the domain: ends too near
    // for their logarithms to differ still keep a tick between them out.
    const [vlo, vhi] = d0 <= d1 ? [d0, d1] : [d1, d0];
    const out: number[] = [];
    for (let p = Math.ceil(first / every) * every; p <= last; p += every) {
      for (const m of steps) {
        const v = Number((m * base ** p).toPrecision(12));
        const slack = Math.min(1e-9 * v, (vhi - vlo) * 1e-9);
        // Powers deep in the subnormals can round onto one another.
        if (v >= vlo - slack && v <= vhi + slack && v !== out.at(-1)) out.push(v);
      }
    }
    return l0 <= l1 ? out : out.reverse();
  };
  // Each label is as precise as its own decade, whatever the count, and another base's powers as their digits need.
  const format = (v: number): string => {
    const decade = v >= 1 ? 0 : decimalsOf(10 ** Math.floor(Math.log10(v)));
    // Digits counted on the value moved up past its decade, as `tickDecimals` counts places to an absolute tolerance.
    return formatNumber(v, 10 ** -(base === 10 ? decade : decade + tickDecimals([v * 10 ** decade])));
  };
  return {
    kind: 'log',
    base,
    domain: [d0, d1],
    range: [r0, r1],
    map,
    position: map,
    invert(at) {
      const t = r1 === r0 ? 0 : (at - r0) / (r1 - r0);
      if (t === 0 || t === 1) return t === 0 ? d0 : d1;
      // A logarithm a rounding past the double range's end would turn into Infinity or 0.
      const v = base ** (l0 + t * (l1 - l0));
      return t > 0 && t < 1 ? Math.min(Math.max(d0, d1), Math.max(Math.min(d0, d1), v)) : v;
    },
    ticks,
    format,
    tickFormat() {
      return replacedFormat(this, format) ?? format;
    },
  };
}
