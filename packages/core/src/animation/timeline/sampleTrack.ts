import { keys as keysPatch, type Patch, type Setting } from '@msb235/blits';
import { resolveEasing } from '@weasel-js/geom';
import { axesOf } from '../engine/axes';
import type { SampledTrack } from './types';

type Out = { v: unknown };
/** What an interpolated track's stops carry: blits finds the segment and eases it, and the
 *  track's own function makes the value. */
interface Box { i: number; value: unknown }

interface Built {
  /** What it was built from, so a cache handed another track, or new keys, rebuilds. */
  track: object;
  keys: readonly unknown[];
  /** Null where there is nothing to interpolate: one key time, or values with no way to lerp. */
  patch: Patch<number, Out, void> | null;
  t0: number;
  span: number;
  /** Every key's time to the value sampling exactly there returns: the later of keys sharing a
   *  time, and the key's own value where blits would reach it as `a + (b - a) * ease(1)`. */
  exact: Map<number, unknown>;
  first: unknown;
  last: unknown;
  read: (v: unknown) => unknown;
}

const NO_SETTING = {} as Setting<void>;
/** Where a cache holds its track's `Built`; segment indexes start at 1. A `WeakMap` keyed on the
 *  cache instead cost about a fifth of every sample. */
const BUILT = -1;

function build<T>(track: SampledTrack<T>, cache: Map<number, (u: number) => T> | undefined): Built {
  const { keys } = track;
  let t0 = Infinity;
  let t1 = -Infinity;
  const exact = new Map<number, unknown>();
  for (const k of keys) {
    t0 = Math.min(t0, k.t);
    t1 = Math.max(t1, k.t);
    exact.set(k.t, k.value);
  }
  const span = t1 - t0;
  const out: Built = { track, keys, patch: null, t0, span, exact, first: keys[0].value, last: keys[keys.length - 1].value, read: (v) => v };
  if (span <= 0) return out;

  const ease = (k: (typeof keys)[number]) => (k.easing ? resolveEasing(k.easing) : undefined);
  const { interpolator, interpolate } = track;
  if (interpolator || interpolate) {
    const boxes: Box[] = keys.map((k, i) => ({ i, value: k.value }));
    const lerp = (a: Box, b: Box, u: number): Box => {
      if (interpolator) {
        let fn = cache?.get(b.i);
        if (!fn) {
          fn = interpolator(a.value as T, b.value as T);
          cache?.set(b.i, fn);
        }
        return { i: -1, value: fn(u) };
      }
      return { i: -1, value: interpolate!(a.value as T, b.value as T, u) };
    };
    out.patch = keysPatch<number, Out>(
      1,
      keys.map((k, i) => ({ at: (k.t - t0) / span, delta: { v: boxes[i] }, ease: ease(k) })),
      { lerpBy: () => lerp as (a: never, b: never, u: number) => unknown },
    );
    out.read = (v) => (v as Box).value;
    return out;
  }

  const axes = axesOf(keys[0].value);
  if (!axes) return out;
  for (const k of keys) {
    if (axesOf(k.value)?.shape !== axes.shape) {
      throw new Error(`sampleTrack: every key needs the shape of the first (${axes.shape})`);
    }
  }
  const scalar = axes.shape === 'number';
  out.patch = keysPatch<number, Out>(
    1,
    keys.map((k) => ({ at: (k.t - t0) / span, delta: { v: scalar ? k.value : axes.to(k.value) }, ease: ease(k) })),
  );
  if (!scalar) out.read = (v) => axes.from(v as number[]);
  return out;
}

/**
 * Sample a track at `t`. Pure: no state, no side effects, safe to call for any
 * `t` in any order — which is what makes scrubbing free.
 *
 * `segmentCache` holds what sampling builds from the keys: the track's blits
 * patch and its `interpolator` factories. Handed another track or a replaced
 * `keys` array, it rebuilds; a key edited in place needs the cache dropped,
 * which `createTimeline` does on `edit`. With no cache, every call builds afresh.
 */
export function sampleTrack<T>(
  track: SampledTrack<T>,
  t: number,
  segmentCache?: Map<number, (u: number) => T>,
): T | undefined {
  if (track.keys.length === 0) return undefined;
  const cache = segmentCache as Map<number, unknown> | undefined;
  let b = cache?.get(BUILT) as Built | undefined;
  if (!b || b.track !== track || b.keys !== track.keys) {
    cache?.clear();
    b = build(track, segmentCache);
    cache?.set(BUILT, b);
  }
  const hit = b.exact.get(t);
  if (hit !== undefined || b.exact.has(t)) return hit as T;
  if (!b.patch) {
    if (t < b.t0) return b.first as T;
    if (t >= b.t0 + b.span) return b.last as T;
    throw new Error('sampleTrack: interpolate or interpolator is required for non-numeric keyframe values');
  }
  return b.read(b.patch.at((t - b.t0) / b.span, 0, NO_SETTING).v) as T;
}
