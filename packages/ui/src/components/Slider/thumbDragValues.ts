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

/** How far thumb `index` can go, low and high: what its aria-valuemin and aria-valuemax say. */
export function reachOf<T extends Thumb>(thumbs: readonly T[], index: number, span: Parameters<typeof draggedValue>[3]): [number, number] {
  return [draggedValue(thumbs, index, -Infinity, span), draggedValue(thumbs, index, Infinity, span)];
}

/** Where thumbs dragged together may land: a stop under `strict`, otherwise the `step` grid from `origin`. */
export interface TogetherSnap {
  strict: boolean;
  stops: readonly number[];
  step: number | undefined;
  origin: number;
}

/** The index of the stop nearest track fraction `f`. */
function nearestStop(stops: readonly number[], f: number, toFraction: (v: number) => number): number {
  let best = 0;
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs(toFraction(stops[i]!) - f) < Math.abs(toFraction(stops[best]!) - f)) best = i;
  }
  return best;
}

/**
 * Thumbs at `startValues` moved together under strict stops, by as many stops as the pointer crossed going from
 * track fraction `fromF` to `toF`: each lands on the stop that many past its own nearest. The move is cut back a stop
 * at a time until `fits` takes the result, and to none, which leaves the thumbs where they started.
 */
export function stopShifted(
  startValues: readonly number[],
  fromF: number,
  toF: number,
  stops: readonly number[],
  toFraction: (v: number) => number,
  fits: (values: readonly number[]) => boolean = () => true,
): number[] {
  const at = startValues.map(v => nearestStop(stops, toFraction(v), toFraction));
  let k = nearestStop(stops, toF, toFraction) - nearestStop(stops, fromF, toFraction);
  k = clamp(k, -minOf(at), stops.length - 1 - maxOf(at));
  for (; k !== 0; k -= Math.sign(k)) {
    const values = at.map(i => stops[i + k]!);
    if (fits(values)) return values;
  }
  return [...startValues];
}

/**
 * Every thumb's value after the pointer has moved from track fraction `anchor` to `at` since a shift-all drag
 * began from `startValues`. The thumbs keep their spacing, and the first to reach an end of the track stops them all.
 * They land where a dragged thumb could: on the step grid, or under strict stops each the same number of stops on.
 */
export function shiftedValues(
  startValues: readonly number[],
  anchor: number,
  at: number,
  scale: {
    /** Equal track distances are unequal value offsets (evenly spaced gaps, or a scale), so move by track distance. */
    byTrack: boolean;
    valueToFraction: (v: number) => number;
    fractionToValue: (f: number) => number;
    min: number;
    max: number;
    snap: TogetherSnap;
  },
): number[] {
  const { min, max, snap } = scale;
  if (snap.strict) return stopShifted(startValues, anchor, at, snap.stops, scale.valueToFraction);
  const dxFraction = at - anchor;
  if (scale.byTrack) {
    const starts = startValues.map(scale.valueToFraction);
    const df = clamp(dxFraction, -minOf(starts), 1 - maxOf(starts));
    return starts.map((f) => clamp(snapToStep(scale.fractionToValue(f + df), snap.step, snap.origin), min, max));
  }
  // Clamp delta so no thumb leaves [min, max] (per-thumb bounds intentionally
  // not enforced — matches the experiment's hue-band shift-translate semantics).
  let allowedNeg = -Infinity;
  let allowedPos = Infinity;
  for (const v of startValues) {
    allowedNeg = Math.max(allowedNeg, min - v);
    allowedPos = Math.min(allowedPos, max - v);
  }
  const dValue = clamp(snapToStep(dxFraction * (max - min), snap.step, 0), allowedNeg, allowedPos);
  return startValues.map((v) => clamp(v + dValue, min, max));
}
