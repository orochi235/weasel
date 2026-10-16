import { useKitSetting } from '@weasel-js/react';

/** How close, in screen pixels, a drag has to come to a candidate to snap to it. */
export const SNAP_RADIUS_PX = 6;

/** {@link SNAP_RADIUS_PX}, or the `targets.snapRadiusPx` kit setting where a provider sets one. */
export function useSnapRadiusPx(): number {
  return useKitSetting('targets.snapRadiusPx') ?? SNAP_RADIUS_PX;
}

/** Snap `value` to the nearest candidate within `tolerance`, else return it. */
export function snapToNearest(value: number, candidates: readonly number[], tolerance: number): number {
  let best = value;
  let bestDist = tolerance;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d <= bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}
