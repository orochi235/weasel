import { replacedFormat } from './replacedFormat';
import type { Scale } from './types';

/** Options for {@link bandScale}. */
export interface BandScaleOptions {
  /** The categories, one band each, in order; a category named twice keeps its first band. */
  domain: readonly string[];
  range: readonly [number, number];
  /** The share of each step left empty between bands, held to 0 to 1. Default, and for `NaN`, 0.2. */
  paddingInner?: number;
  /** The room before the first band and after the last, in steps. Default, and for one that is not finite, half of
   *  `paddingInner`. */
  paddingOuter?: number;
}

/** A scale that cuts its range into equal bands, one per category, as a bar chart's category axis does. */
export interface BandScale extends Scale<string> {
  readonly kind: 'band';
  readonly domain: readonly string[];
  /** The width of each band. */
  readonly bandwidth: number;
  /** From one band's start to the next's. */
  readonly step: number;
  /** Where `key`'s band starts, or `NaN` for a key not in the domain. */
  start(key: string): number;
  /** The key whose band is nearest `at`; `undefined` for an empty domain. */
  invert(at: number): string | undefined;
  tickFormat(): (key: string) => string;
}

/** A band scale over `domain`. */
export function bandScale(opts: BandScaleOptions): BandScale {
  const domain = [...new Set(opts.domain)];
  const [r0, r1] = opts.range;
  // A padding that is not a number takes its default, as an absent one does.
  const inner = Math.min(1, Math.max(0, Number.isNaN(opts.paddingInner) ? 0.2 : opts.paddingInner ?? 0.2));
  const outer = Number.isFinite(opts.paddingOuter) ? Math.max(0, opts.paddingOuter!) : inner / 2;
  const n = domain.length;
  const step = n === 0 ? 0 : (r1 - r0) / Math.max(1e-9, n - inner + 2 * outer);
  const bandwidth = Math.abs(step * (1 - inner));
  const index = new Map(domain.map((key, i) => [key, i]));
  const startAt = (i: number) => r0 + step * (outer + i) + (step < 0 ? step * (1 - inner) : 0);
  const start = (key: string) => {
    const i = index.get(key);
    return i === undefined ? Number.NaN : startAt(i);
  };
  const format = (key: string): string => key;
  return {
    kind: 'band',
    domain,
    range: [r0, r1],
    bandwidth,
    step: Math.abs(step),
    start,
    position: (key) => start(key) + bandwidth / 2,
    invert: (at) => {
      if (n === 0) return undefined;
      if (step === 0) return domain[0];
      const i = Math.round((at - r0) / step - outer - (1 - inner) / 2);
      return domain[Math.min(n - 1, Math.max(0, i))];
    },
    ticks: () => [...domain],
    format,
    tickFormat() {
      return replacedFormat(this, format) ?? format;
    },
  };
}
