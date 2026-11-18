import { snapToStep } from '@weasel-js/quantity';
import { clamp, maxOf, minOf } from '@weasel-js/geom';
import { clampOrdered } from '@weasel-js/ui-input';
import { resolveBounds } from './stops';
import type { Thumb } from './types';

/** The value thumb `index` takes when dragged to `v`: held within its bounds, and between its neighbors when ordered. */
export function draggedValue<T extends Thumb>(
  thumbs: readonly T[],
  index: number,
  v: number,
  span: { min: number; max: number; step: number | undefined; ordered: boolean },
): number {
  const [lo, hi] = resolveBounds(thumbs[index], { thumbs, index }, span.min, span.max);
  const held = clamp(v, lo, hi);
  return span.ordered ? clampOrdered(held, thumbs, index, lo, hi, span.step) : held;
}

/**
 * Every thumb's value after the pointer has moved `dxFraction` of the track since a shift-all drag began from
 * `startValues`. The thumbs keep their spacing, and the first to reach an end of the track stops them all.
 */
export function shiftedValues(
  startValues: readonly number[],
  dxFraction: number,
  scale: {
    /** Equal track distances are unequal value offsets (evenly spaced gaps, or a scale), so move by track distance. */
    byTrack: boolean;
    valueToFraction: (v: number) => number;
    fractionToValue: (f: number) => number;
    min: number;
    max: number;
    step: number | undefined;
  },
): number[] {
  if (scale.byTrack) {
    const starts = startValues.map(scale.valueToFraction);
    const df = clamp(dxFraction, -minOf(starts), 1 - maxOf(starts));
    return starts.map((f) => scale.fractionToValue(f + df));
  }
  const { min, max } = scale;
  // Clamp delta so no thumb leaves [min, max] (per-thumb bounds intentionally
  // not enforced — matches the experiment's hue-band shift-translate semantics).
  let allowedNeg = -Infinity;
  let allowedPos = Infinity;
  for (const v of startValues) {
    allowedNeg = Math.max(allowedNeg, min - v);
    allowedPos = Math.min(allowedPos, max - v);
  }
  const dValue = clamp(snapToStep(dxFraction * (max - min), scale.step, 0), allowedNeg, allowedPos);
  return startValues.map((v) => clamp(v + dValue, min, max));
}
