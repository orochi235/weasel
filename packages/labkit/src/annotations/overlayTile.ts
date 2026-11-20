import { type RefObject, useEffect, useRef } from 'react';
import type { useSurfaceOptional } from '../surface/useSurfaceTile';

/** Keep a target's element registered as surface tile `tileId`, following the element as it changes, and take the
 *  tile out on unmount. */
export function useOverlayTile(
  surface: ReturnType<typeof useSurfaceOptional>,
  tileId: string,
  ref: RefObject<HTMLElement | null>,
): void {
  const lastTile = useRef<HTMLElement | null>(null);
  const release = useRef<(() => void) | null>(null);
  useEffect(() => {
    const el = ref.current ?? null;
    if (el === lastTile.current) return;
    lastTile.current = el;
    release.current?.();
    // eslint-disable-next-line weasel/effect-cleanup -- the effect below unregisters on unmount
    release.current = el && surface ? surface.registerTile(tileId, el) : null;
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new surface or id releases the tile, and the effect above registers it again
  useEffect(
    () => () => {
      // Clearing this is what lets the effect above re-register on the next
      // commit. StrictMode's mount / unmount / mount would otherwise take the
      // tile out and never put it back, and the surface would measure nothing.
      lastTile.current = null;
      release.current?.();
      release.current = null;
    },
    [surface, tileId],
  );
}
