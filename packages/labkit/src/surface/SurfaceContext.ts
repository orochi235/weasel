import { createContext } from 'react';
import type { SurfaceHandle } from './useTiledSurface';

/** Null when no surface owner is above — a lab with no shared surface at all. */
export const SurfaceContext = createContext<SurfaceHandle | null>(null);

/** The buffer the surface's tiles paint into. Null until the owner's canvas is
 *  mounted, and for an owner that keeps its surface unpainted. */
export const SurfaceCanvasContext = createContext<HTMLCanvasElement | null>(null);
