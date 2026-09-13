import { createContext } from 'react';
import type { SurfaceHandle } from './useTiledSurface';

/** Null when no surface owner is above — a lab with no shared surface at all. */
export const SurfaceContext = createContext<SurfaceHandle | null>(null);

/**
 * Which of the two stacked buffers a tenant paints into.
 *
 * `'over'` sits above the trial DOM: right for marks that annotate an
 * instrument, which is what the surface was built for and so the default.
 * `'under'` sits below it, which is what an opaque renderer needs — a tile that
 * fills its pane hides anything the pane's own DOM draws, so a 3D viewport on
 * the over-buffer has to paint its own chrome into the backend rather than
 * putting a label or a button in the pane.
 *
 * Both exist for the lifetime of the surface and share one set of tile rects,
 * so a lab can hold an annotated 2D trial and an opaque 3D one at once.
 */
export type SurfaceLayer = 'over' | 'under';

/** The two buffers a surface owner publishes. A member is null until the
 *  owner's canvas mounts, and for an owner that keeps its surface unpainted. */
export interface SurfaceCanvases {
  over: HTMLCanvasElement | null;
  under: HTMLCanvasElement | null;
}

const NO_CANVASES: SurfaceCanvases = { over: null, under: null };

/** The buffers the surface's tiles paint into. */
export const SurfaceCanvasContext = createContext<SurfaceCanvases>(NO_CANVASES);
