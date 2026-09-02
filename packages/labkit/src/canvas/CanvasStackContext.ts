import { createContext, type RefObject } from 'react';
import type { ViewTransform } from '../instrument/types';
import type { CanvasLayerDescriptor } from './useLayerScheduler';
import type { WorldFrame } from './worldSpec';

/** The stack's own drawing surface, for an overlay that has to re-draw it at
 *  another camera or read back what it presented — a loupe. */
export interface CanvasStackSurface {
  /** The element the layers are stacked in, and the one pan/zoom listens on. */
  element: RefObject<HTMLElement | null>;
  /** Its measured CSS size, and the ratio the backing stores are scaled by. */
  size: { width: number; height: number; dpr: number };
  /** The presented `<canvas>` per layer id. */
  canvases: RefObject<Map<string, HTMLCanvasElement>>;
  /** The layers as the stack is drawing them, bottom first. */
  layers: readonly CanvasLayerDescriptor[];
}

/** What a canvas stack publishes to its children: the view, and the resolved
 *  coordinate system it is read in, so DOM overlays can place themselves in the
 *  same coordinates the layers draw in. */
export interface CanvasStackContextValue {
  view: ViewTransform;
  frame: WorldFrame;
  /** Absent from a context assembled by hand, which has no stack behind it. */
  surface?: CanvasStackSurface;
}

/** Context carrying the surrounding canvas stack's view and world frame. */
export const CanvasStackContext = createContext<CanvasStackContextValue | null>(null);
