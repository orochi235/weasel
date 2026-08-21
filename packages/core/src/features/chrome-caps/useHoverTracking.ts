/**
 * useHoverTracking — last-hovered NodeId for chrome-caps rules.
 *
 * Attaches a `pointermove` listener to the supplied canvas; on each
 * move, converts client coords → world coords and runs the supplied
 * `getNodeAtPoint`, caching the resulting id on a ref. Cleared on
 * `pointerleave` (pointer left the canvas → nothing is hovered).
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
  /** Client → world conversion. Same shape as the dispatcher's. */
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  /** Topmost-id resolver. Returns null when the world point hits nothing. */
  getNodeAtPoint: (worldX: number, worldY: number) => { id: NodeId } | null;
  enabled?: boolean;
}

/** Track which node the pointer is over. Returns a getter rather than state,
 *  so per-frame code can read the current value without the hover re-rendering
 *  the component on every pointer move. */
export function useHoverTracking(args: UseHoverTrackingArgs): () => NodeId | null {
  const { canvasRef, clientToWorld, getNodeAtPoint, enabled = true } = args;
  const hoverRef = useRef<NodeId | null>(null);
  const clientToWorldRef = useRef(clientToWorld);
  clientToWorldRef.current = clientToWorld;
  const getNodeAtPointRef = useRef(getNodeAtPoint);
  getNodeAtPointRef.current = getNodeAtPoint;

  useEffect(() => {
    if (!enabled) return;
    const c = canvasRef.current;
    if (!c) return;
    const onMove = (e: PointerEvent) => {
      const w = clientToWorldRef.current(e.clientX, e.clientY);
      const hit = getNodeAtPointRef.current(w.x, w.y);
      hoverRef.current = hit?.id ?? null;
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
