import { useCallback, useContext } from 'react';
import { SurfaceContext } from './SurfaceContext';
import type { SurfaceHandle } from './useTiledSurface';

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
 * A ref callback that publishes this element's rect to the surface under `id`.
 *
 * Attach it to whichever element the surface should draw into — that is not
 * necessarily the trial's own element, since a trial may hold a drawn pane beside
 * an undrawn one, or none at all.
 */
export function useSurfaceTile(id: string): (el: HTMLElement | null) => void {
  const surface = useSurfaceOptional();
  return useCallback(
    (el: HTMLElement | null) => {
      surface?.registerTile(id, el);
    },
    [surface, id],
  );
}
