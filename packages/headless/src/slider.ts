import { clamp } from '@weasel-js/geom';
import { snapToStep } from '@weasel-js/quantity';
import { rangeKey } from './keySteps';

/** A value on a slider's track the thumb can come to rest on, with whatever label draws under it. */
export interface SliderStop<L = unknown> {
  value: number;
  label?: L;
}

/** The stops that are actually reachable: inside the range, deduped, ascending.
 *  A duplicate keeps the first label given for its value. */
export function usableStops<L>(
  stops: readonly (number | SliderStop<L>)[] | undefined, min: number, max: number,
): SliderStop<L>[] {
  if (!stops || stops.length === 0) return [];
  const byValue = new Map<number, SliderStop<L>>();
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
export function attract(v: number, stops: readonly number[], tolerance: number, toFraction: (v: number) => number): number {
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
export function stepStops(stops: readonly number[], v: number, direction: 1 | -1, count: number): number {
  if (direction > 0) {
    const first = stops.findIndex(stop => stop > v);
    if (first === -1) return stops[stops.length - 1]!;
    return stops[Math.min(stops.length - 1, first + count - 1)]!;
  }
  let first = -1;
  for (let i = stops.length - 1; i >= 0; i--) {
    if (stops[i]! < v) {
      first = i;
      break;
    }
  }
  if (first === -1) return stops[0]!;
  return stops[Math.max(0, first - (count - 1))]!;
}

/** `step` when it is positive; otherwise a hundredth of the span. */
export function defaultStep(step: number | undefined, min: number, max: number): number {
  if (step !== undefined && step > 0) return step;
  return (max - min) / 100;
}

/** Keep thumb `index` strictly between its neighbors: a step apart, or a thousandth of the span without one. */
export function clampOrdered(
  v: number,
  thumbs: readonly { value: number }[],
  index: number,
  min: number,
  max: number,
  step: number | undefined,
): number {
  const gap = step !== undefined && step > 0 ? step : (max - min) / 1000;
  const lower = index > 0 ? thumbs[index - 1]!.value + gap : min;
  const upper = index < thumbs.length - 1 ? thumbs[index + 1]!.value - gap : max;
  return clamp(v, lower, upper);
}

/**
 * Where a keystroke of `delta` takes a thumb at `from` when the move meets an
 * end of the slider's finite `range`, or `null` when it stays inside. An
 * endless end's stop lies on the `track` beyond the range, at a distance drawn
 * for the eye; to the keyboard it is one press past the range's end. A move
 * that would overshoot the end lands on the end first.
 */
export function crossEnd(
  from: number,
  delta: number,
  stepSize: number,
  range: readonly [number, number],
  track: readonly [number, number],
): number | null {
  const [lo, hi] = range;
  if (from > hi) return delta < 0 ? hi + delta + stepSize : from;
  if (from < lo) return delta > 0 ? lo + delta - stepSize : from;
  if (from + delta > hi) return from < hi ? hi : track[1];
  if (from + delta < lo) return from > lo ? lo : track[0];
  return null;
}

/** What a key press on one thumb of a slider reads. */
export interface SliderKeyShape {
  thumbs: readonly { value: number }[];
  /** The thumb the key went to. */
  index: number;
  /** The ends of the track. */
  min: number;
  max: number;
  step?: number;
  /** Usable stops, ascending. With any, a keystroke moves by whole stops rather than by value. */
  stops?: readonly number[];
  /** Keep the thumb between its neighbors. */
  ordered?: boolean;
  /** The finite range, where the track runs past it to an endless end's stop. Default the track. */
  range?: readonly [number, number];
  /** Under `'rtl'` the horizontal arrows are mirrored, as the values run from the right end. */
  dir?: 'ltr' | 'rtl';
  /** This thumb's own limits inside the track. Read only for a key the slider answers to. */
  bounds?(): readonly [number, number];
  /** Where the thumb lands `steps` presses away, for a track whose values aren't what the user counts in. */
  keyStep?(steps: number): number;
}

/** The value one key moves thumb `index` to: arrows by a step (ten with Shift), the Page keys by ten,
 *  Home and End to the thumb's ends. `null` for a key the slider does not answer to. */
export function sliderKey(key: string, shift: boolean, shape: SliderKeyShape): number | null {
  const move = rangeKey(key, shift, shape.dir);
  if (move === null) return null;
  const { thumbs, index, min, max, step } = shape;
  const from = thumbs[index]!.value;
  const [bLo, bHi] = shape.bounds?.() ?? [min, max];
  const lo = Math.max(min, bLo);
  const hi = Math.min(max, bHi);
  const stops = shape.stops ?? [];
  let v: number;
  if (move === 'home') v = lo;
  else if (move === 'end') v = hi;
  else if (shape.keyStep) v = shape.keyStep(move);
  else if (stops.length > 0) v = stepStops(stops, from, move > 0 ? 1 : -1, Math.abs(move));
  else {
    const range = shape.range ?? [min, max];
    const stepSize = defaultStep(step, range[0], range[1]);
    const delta = move * stepSize;
    v = crossEnd(from, delta, stepSize, range, [min, max]) ?? snapToStep(from + delta, step, min);
  }
  v = clamp(v, lo, hi);
  return shape.ordered ? clampOrdered(v, thumbs, index, lo, hi, step) : v;
}
