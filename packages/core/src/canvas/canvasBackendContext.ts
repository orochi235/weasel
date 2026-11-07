import { createContext } from 'react';
import type { CanvasBackend } from './canvasBackend';

/** The backend every canvas beneath it paints with, unless it names its own
 *  (`CanvasProps.backend`). Default `'webgl2'`. */
export const CanvasBackendContext = createContext<CanvasBackend>('webgl2');

/** Set the backend of every canvas beneath it: a page reading `?backend=` hands it down here. */
export const CanvasBackendProvider = CanvasBackendContext.Provider;
