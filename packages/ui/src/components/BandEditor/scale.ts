import { isDev } from '@weasel-js/registry';
import { linearScale, logScale, type ContinuousScale, type ContinuousScaleFactory } from '@weasel-js/plot/scales';

export function clamp01(u: number): number {
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

/** `scale` from `[min, max]` onto the track, `[0, 1]`. */
export function unitScale(scale: ContinuousScaleFactory, min: number, max: number): ContinuousScale {
  return scale({ domain: [min, max], range: [0, 1] });
}

/** A value's place along the track and back, both held to the track's ends. */
export function trackOf(scale: ContinuousScaleFactory, min: number, max: number) {
  const unit = unitScale(scale, min, max);
  return {
    toUnit: (v: number): number => clamp01(unit.map(v)),
    fromUnit: (u: number): number => unit.invert(clamp01(u)),
  };
}

let warnedNonPositiveMin = false;

/**
 * Resolves the `scale` prop, substituting `linearScale` for a `logScale`
 * that `min` would make throw.
 */
export function resolveScale(
  scale: 'linear' | 'log' | ContinuousScaleFactory | undefined,
  min: number,
): ContinuousScaleFactory {
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
 * drawn across only that stretch: a value lands where it would on the whole
 * axis. The scale it builds still runs over `[min, max]`, with its range
 * stretched so that `lo` and `hi` land on the ends it is given.
 */
export function withinAxis(scale: ContinuousScaleFactory, min: number, max: number): ContinuousScaleFactory {
  return ({ domain: [lo, hi], range: [r0, r1] }) => {
    const whole = unitScale(scale, min, max);
    const a = whole.map(lo);
    const b = whole.map(hi);
    if (b === a) return scale({ domain: [min, max], range: [r0, r0] });
    const stretch = (r1 - r0) / (b - a);
    const start = r0 - a * stretch;
    return scale({ domain: [min, max], range: [start, start + stretch] });
  };
}
