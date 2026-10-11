import { clamp } from '@weasel-js/geom';
import { decimal } from '@weasel-js/quantity';
import type { BoundsCtx, SliderProps, SliderStop, Thumb } from './types';

/** How close a drag has to come to a stop, in track pixels, to land on it. */
export const STOP_SNAP_PX = 8;

/** The stops that are actually reachable: inside the range, deduped, ascending.
 *  A duplicate keeps the first label given for its value. */
export function usableStops(stops: SliderProps['stops'], min: number, max: number): SliderStop[] {
  if (!stops || stops.length === 0) return [];
  const byValue = new Map<number, SliderStop>();
  for (const stop of stops) {
    const s = typeof stop === 'number' ? { value: stop } : stop;
    if (s.value < min || s.value > max) continue;
    const seen = byValue.get(s.value);
    if (!seen || (seen.label === undefined && s.label !== undefined)) byValue.set(s.value, s);
  }
  return [...byValue.values()].sort((a, b) => a.value - b.value);
}

/** The stop nearest `v` along the track, or `v` itself when none lies within
 *  `tolerance` (a track fraction). Measured on the track rather than in value
 *  units so evenly spaced stops attract over the same distance. */
export function attract(v: number, stops: number[], tolerance: number, toFraction: (v: number) => number): number {
  const f = toFraction(v);
  let best = v;
  let bestGap = tolerance;
  for (const stop of stops) {
    const gap = Math.abs(toFraction(stop) - f);
    if (gap <= bestGap) {
      best = stop;
      bestGap = gap;
    }
  }
  return best;
}

/** The stop `count` places past `v` in `direction`, saturating at either end. */
export function stepStops(stops: number[], v: number, direction: 1 | -1, count: number): number {
  if (direction > 0) {
    const first = stops.findIndex(stop => stop > v);
    if (first === -1) return stops[stops.length - 1];
    return stops[Math.min(stops.length - 1, first + count - 1)];
  }
  let first = -1;
  for (let i = stops.length - 1; i >= 0; i--) {
    if (stops[i] < v) {
      first = i;
      break;
    }
  }
  if (first === -1) return stops[0];
  return stops[Math.max(0, first - (count - 1))];
}

export function defaultStep(step: number | undefined, min: number, max: number): number {
  if (step !== undefined && step > 0) return step;
  return (max - min) / 100;
}

/** Keep a thumb inside its neighbors when `constraint` is `'ordered'`. */
export function clampOrdered(
  v: number,
  thumbs: readonly Thumb[],
  index: number,
  min: number,
  max: number,
  step: number | undefined,
): number {
  const gap = step !== undefined && step > 0 ? step : (max - min) / 1000;
  const lower = index > 0 ? thumbs[index - 1].value + gap : min;
  const upper = index < thumbs.length - 1 ? thumbs[index + 1].value - gap : max;
  return clamp(v, lower, upper);
}

export function resolveBounds(thumb: Thumb, ctx: BoundsCtx, fallbackMin: number, fallbackMax: number): [number, number] {
  if (!thumb.bounds) return [fallbackMin, fallbackMax];
  const tuple = typeof thumb.bounds === 'function' ? thumb.bounds(ctx) : thumb.bounds;
  return [tuple[0], tuple[1]];
}

/** Where fraction `f` of the value span falls in a box as wide as the track.
 *  The rail element is laid out from the same `--rp-thumb-inset`. */
export function fractionToPosition(f: number): string {
  return `calc(var(--rp-thumb-inset) + ${f} * (100% - 2 * var(--rp-thumb-inset)))`;
}

export const READOUT = decimal({ places: 3 });
