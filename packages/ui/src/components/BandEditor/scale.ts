import { clamp01 } from '@weasel-js/geom';
import type { ContinuousScale, ContinuousScaleFactory } from '@weasel-js/scale';

/** `scale` from `[min, max]` onto the track, `[0, 1]`. */
export function unitScale(scale: ContinuousScaleFactory, min: number, max: number): ContinuousScale {
  return scale({ domain: [min, max], range: [0, 1] });
}

/** The axis onto the track, and a value's place along it and back, both held to the track's ends. */
export function trackOf(scale: ContinuousScaleFactory, min: number, max: number) {
  const unit = unitScale(scale, min, max);
  return {
    unit,
    toUnit: (v: number): number => clamp01(unit.position(v)),
    fromUnit: (u: number): number => unit.invert(clamp01(u)),
  };
}

/**
 * The axis as drawn while an edge drag holds the range at `range`: an edge pulled past `[min, max]` stretches the
 * axis to hold it, and one pulled inward leaves the axis alone, so the track it vacated shows empty. `bandScale`
 * is `scale` laid over the stretch the bands cover.
 */
export function drawnAxis(scale: ContinuousScaleFactory, min: number, max: number, range: readonly [number, number] | undefined) {
  const [lo, hi] = range ?? [min, max];
  const axisMin = Math.min(min, lo);
  const axisMax = Math.max(max, hi);
  const bandScale = lo === axisMin && hi === axisMax ? scale : withinAxis(scale, axisMin, axisMax);
  return { lo, hi, axisMin, axisMax, bandScale, ...trackOf(scale, axisMin, axisMax) };
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
    const a = whole.position(lo);
    const b = whole.position(hi);
    if (b === a) return scale({ domain: [min, max], range: [r0, r0] });
    const stretch = (r1 - r0) / (b - a);
    const start = r0 - a * stretch;
    return scale({ domain: [min, max], range: [start, start + stretch] });
  };
}
