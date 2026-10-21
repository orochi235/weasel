import { createContext } from 'react';
import type { SurfaceHandle } from './useTiledSurface';

/** Null when no surface owner is above — a lab with no shared surface at all. */
export const SurfaceContext = createContext<SurfaceHandle | null>(null);

/**
 * Which of the stacked buffers a tenant paints into.
 *
 * `'over'` sits above the trial DOM: right for marks that annotate an
 * instrument, and the default. `'under'` sits below it, which is what an
 * opaque renderer needs — a tile that fills its pane hides anything the
 * pane's own DOM draws. `'top'` sits above `'over'` and is for one tenant
 * whose tile covers the whole surface (the lab's lenses): a renderer clears
 * the rect it paints, so sharing a buffer with it would erase every other
 * tenant's pixels.
 *
 * `'over'` and `'under'` exist for the lifetime of the surface; `'top'` only
 * while some tenant asks for it. All share one set of tile rects.
 */
export type SurfaceLayer = 'over' | 'under' | 'top';

/** The buffers a surface owner publishes. A member is null until the owner's
 *  canvas mounts, and for an owner that keeps its surface unpainted. */
export interface SurfaceCanvases {
  over: HTMLCanvasElement | null;
  under: HTMLCanvasElement | null;
  /** Null until a tenant has claimed it and its canvas has mounted. */
  top?: HTMLCanvasElement | null;
  /** Asks the owner for the `top` buffer. Returns the release; the buffer goes
   *  away when the last claim is released. Absent where no owner offers one. */
  claimTop?: () => () => void;
}

const NO_CANVASES: SurfaceCanvases = { over: null, under: null };

/** The buffers the surface's tiles paint into. */
export const SurfaceCanvasContext = createContext<SurfaceCanvases>(NO_CANVASES);
