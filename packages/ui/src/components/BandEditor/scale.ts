import { isDev } from '@weasel-js/registry';
import { linearScale, logScale, type SliderScale } from '../Slider/scale';

export { linearScale, logScale };

/** A `BandEditor`'s axis: the same mapping a `Slider` takes as its `scale`. */
export type BandScale = SliderScale;

export function clamp01(u: number): number {
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

let warnedNonPositiveMin = false;

/**
 * Resolves the `scale` prop, substituting `linearScale` for a `logScale`
 * that `min` would send to `NaN`.
 */
export function resolveScale(
  scale: 'linear' | 'log' | BandScale | undefined,
  min: number,
): BandScale {
  const requested =
    scale === undefined || scale === 'log'
      ? logScale
      : scale === 'linear'
        ? linearScale
        : scale;

  if (requested !== logScale || min > 0) return requested;

  if (isDev() && !warnedNonPositiveMin) {
    warnedNonPositiveMin = true;
    console.warn(
      `BandEditor: a log scale needs min > 0, but min is ${min}. Falling back to a linear scale. ` +
        `Pass scale="linear" to silence this.`,
    );
  }
  return linearScale;
}

/**
 * `scale` laid over a stretch `[lo, hi]` of the axis `[min, max]`, for a box
 * drawn across only that stretch: a value lands where it would on the whole axis.
 */
export function withinAxis(scale: BandScale, min: number, max: number): BandScale {
  const u = (v: number) => scale.toUnit(v, min, max);
  return {
    toUnit: (value, lo, hi) => (u(hi) === u(lo) ? 0 : (u(value) - u(lo)) / (u(hi) - u(lo))),
    fromUnit: (unit, lo, hi) => scale.fromUnit(u(lo) + unit * (u(hi) - u(lo)), min, max),
  };
}
