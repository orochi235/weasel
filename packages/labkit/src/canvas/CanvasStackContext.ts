import { createContext } from 'react';
import type { ViewTransform } from '../instrument/types';
import type { WorldFrame } from './worldSpec';

/** What a canvas stack publishes to its children: the view, and the resolved
 *  coordinate system it is read in, so DOM overlays can place themselves in the
 *  same coordinates the layers draw in. */
export interface CanvasStackContextValue {
  view: ViewTransform;
  frame: WorldFrame;
}

/** Context carrying the surrounding canvas stack's view and world frame. */
export const CanvasStackContext = createContext<CanvasStackContextValue | null>(null);
