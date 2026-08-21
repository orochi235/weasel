import { createContext } from 'react';
import type { ViewTransform } from '../instrument/types';

/** What a canvas stack publishes to its children — currently the view, so
 *  DOM overlays can position themselves in the same coordinates. */
export interface CanvasStackContextValue {
  view: ViewTransform;
}

/** Context carrying the surrounding canvas stack's view. */
export const CanvasStackContext = createContext<CanvasStackContextValue | null>(null);
