/**
 * useHoverTracking — last-hovered NodeId for chrome-caps rules.
 *
 * Attaches a `pointermove` listener to the supplied canvas; on each move it
 * runs the supplied `nodeAtClientPoint` and caches the resulting id on a ref.
 * Cleared on `pointerleave` (pointer left the canvas → nothing is hovered).
 *
 * Returns a stable getter — call once per frame from `buildChromeCtx`.
 *
 * No re-render: the ref updates silently, and the next render that
 * reads it picks up the fresh value. Chrome-caps rules are evaluated
 * during paint, so the hover state is always read fresh.
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { NodeId } from '../../core/scene/types';

/** Options for `useHoverTracking`. */
export interface UseHoverTrackingArgs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Topmost id under a client point, or null. One lookup rather than a
   *  client→world thunk beside a world-space picker: a screen-pixel pick
   *  tolerance converts against the camera the point resolved to, and two
   *  thunks are two chances to disagree about which view that is. */
  nodeAtClientPoint: (clientX: number, clientY: number) => { id: NodeId } | null;
  enabled?: boolean;
}

/** Track which node the pointer is over. Returns a getter rather than state,
 *  so per-frame code can read the current value without the hover re-rendering
 *  the component on every pointer move. */
export function useHoverTracking(args: UseHoverTrackingArgs): () => NodeId | null {
  const { canvasRef, nodeAtClientPoint, enabled = true } = args;
  const hoverRef = useRef<NodeId | null>(null);
  const nodeAtRef = useRef(nodeAtClientPoint);
  nodeAtRef.current = nodeAtClientPoint;

  useEffect(() => {
    if (!enabled) return;
    const c = canvasRef.current;
    if (!c) return;
    const onMove = (e: PointerEvent) => {
      hoverRef.current = nodeAtRef.current(e.clientX, e.clientY)?.id ?? null;
    };
    const onLeave = () => { hoverRef.current = null; };
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerleave', onLeave);
    return () => {
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerleave', onLeave);
    };
  }, [canvasRef, enabled]);

  return () => hoverRef.current;
}
