import { useCallback, useSyncExternalStore } from 'react';
import { useKitSettings, type KitSettingsStore } from '@weasel-js/react';

/** How close, in screen pixels, a drag has to come to a candidate to snap to it. */
export const SNAP_RADIUS_PX = 6;

/** {@link SNAP_RADIUS_PX}, or the `targets.snapRadiusPx` setting where `store` sets one. */
export function snapRadiusPx(store: KitSettingsStore | undefined): number {
  return store?.get('targets.snapRadiusPx') ?? SNAP_RADIUS_PX;
}

/** {@link snapRadiusPx} of the nearest kit settings, re-rendering when that setting changes. */
export function useSnapRadiusPx(): number {
  const store = useKitSettings();
  const read = useCallback(() => snapRadiusPx(store), [store]);
  return useSyncExternalStore(store.subscribe, read, read);
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
