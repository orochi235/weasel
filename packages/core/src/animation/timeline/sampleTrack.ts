import type { SampledTrack } from './types';

/** Index of the last key at or before `t`, or -1 when `t` precedes all keys.
 *  Binary search: tracks are sorted and may be long. */
function floorKeyIndex<T>(keys: SampledTrack<T>['keys'], t: number): number {
  let lo = 0;
  let hi = keys.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Sample a track at `t`. Pure: no state, no side effects, safe to call for any
 * `t` in any order — which is what makes scrubbing free.
 *
 * `segmentCache` memoizes `interpolator` factories by the index of the segment's
 * later key. Callers that mutate keys must drop the cache; `createTimeline`
 * keys it on the timeline version.
 */
export function sampleTrack<T>(
  track: SampledTrack<T>,
  t: number,
  segmentCache?: Map<number, (u: number) => T>,
): T | undefined {
  const { keys } = track;
  if (keys.length === 0) return undefined;

  const i = floorKeyIndex(keys, t);
  if (i < 0) return keys[0].value;
  if (i >= keys.length - 1) return keys[keys.length - 1].value;

  const a = keys[i];
  const b = keys[i + 1];
  const span = b.t - a.t;
  const raw = span <= 0 ? 1 : (t - a.t) / span;
  // `easing` belongs to the key being approached, so `b` supplies it.
  const u = b.easing ? b.easing(raw) : raw;

  if (track.interpolator) {
    let fn = segmentCache?.get(i + 1);
    if (!fn) {
      fn = track.interpolator(a.value, b.value);
      segmentCache?.set(i + 1, fn);
    }
    return fn(u);
  }
  if (track.interpolate) return track.interpolate(a.value, b.value, u);

  if (typeof a.value === 'number' && typeof b.value === 'number') {
    return ((a.value as number) + ((b.value as number) - (a.value as number)) * u) as unknown as T;
  }
  throw new Error('sampleTrack: interpolate or interpolator is required for non-numeric keyframe values');
}
