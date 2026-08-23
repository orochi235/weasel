import { createContext } from 'react';
import type { SurfaceHandle } from './useTiledSurface';

/** Null when no surface owner is above — a lab with no shared surface at all. */
export const SurfaceContext = createContext<SurfaceHandle | null>(null);
