import { useCallback, useContext } from 'react';
import { TrialIdContext } from '../state/context';
import { SurfaceCanvasContext, SurfaceContext } from './SurfaceContext';
import type { SurfaceHandle } from './useTiledSurface';

/** The surface's shared buffer, or null where nothing paints one. What a tile
 *  hands to `paintInto`. */
export function useSurfaceCanvas(): HTMLCanvasElement | null {
  return useContext(SurfaceCanvasContext);
}

/** The surface above, or null. Use this where a surface is genuinely optional. */
export function useSurfaceOptional(): SurfaceHandle | null {
  return useContext(SurfaceContext);
}

/** The surface above. Throws where a caller cannot work without one. */
export function useSurface(): SurfaceHandle {
  const surface = useContext(SurfaceContext);
  if (!surface) throw new Error('[labkit] useSurface requires a surface owner above it');
  return surface;
}

/**
 * The key `id` is registered under, and so the key it comes back on in a
 * frame's `rects`: `<trial>/<id>` inside a trial, and `id` alone outside one.
 *
 * A surface's tile namespace is flat and shared by the whole lab, but an
 * instrument names its regions once and every trial of it declares those same
 * names. Unscoped, the second trial to mount takes the first one's rect and its
 * painter, and the first is never told it moved again.
 */
export function useTileId(id: string): string {
  const trial = useContext(TrialIdContext);
  return trial ? `${trial}/${id}` : id;
}

/**
 * A ref callback that publishes this element's rect to the surface under `id`.
 *
 * Attach it to whichever element the surface should draw into — that is not
 * necessarily the trial's own element, since a trial may hold a drawn pane beside
 * an undrawn one, or none at all.
 *
 * The frame reports it under `useTileId(id)`, not under `id`.
 */
export function useSurfaceTile(id: string): (el: HTMLElement | null) => void {
  const surface = useSurfaceOptional();
  const tileId = useTileId(id);
  return useCallback(
    (el: HTMLElement | null) => {
      surface?.registerTile(tileId, el);
    },
    [surface, tileId],
  );
}
