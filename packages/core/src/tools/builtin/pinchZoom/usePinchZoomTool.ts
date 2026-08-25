import { useRef } from 'react';
import { usePinchGesture } from 'core/viewport/usePinchGesture';
import { zoomAt } from 'core/viewport/zoomAt';
import { clientToCanvas } from 'core/viewport/clientToCanvas';
import type { View } from 'core/viewport/view';

/** The camera a pinch acts on, and the origin its anchor is measured from. */
export interface PinchZoomTarget {
  view: View;
  setView: (v: View) => void;
  /** Client-space origin of the surface this camera paints into. */
  origin: { left: number; top: number };
}

/** Options for `usePinchZoomTool`: the zoom limits, and whether it is wired
 *  at all. */
export interface PinchZoomToolOpts {
  min?: number;
  max?: number;
  enabled?: boolean;
  /**
   * Which camera the anchor point belongs to. Return `null` — or omit this —
   * for the canvas's own. A canvas hosting several views resolves the point
   * here, so a pinch inside a panel zooms the panel rather than the canvas
   * underneath it.
   */
  resolveTarget?: (clientX: number, clientY: number) => PinchZoomTarget | null;
}

/**
 * Two-finger pinch zoom on the canvas. Standalone hook (not a Tool record)
 * because it requires direct multi-pointer access on the canvas element.
 *
 * The anchor point under the gesture midpoint stays fixed on screen as the
 * view scales.
 *
 * @param getView Read at gesture time, not at render time: each pinch move
 *   applies a per-frame delta to the view the previous move produced, and the
 *   canvas does not re-render between them.
 */
export function usePinchZoomTool(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  getView: () => View,
  setView: (v: View) => void,
  opts: PinchZoomToolOpts = {},
) {
  const getViewRef = useRef(getView);
  getViewRef.current = getView;
  const setViewRef = useRef(setView);
  setViewRef.current = setView;
  const { min = 0.1, max = 8, enabled = true } = opts;
  const resolveTargetRef = useRef(opts.resolveTarget);
  resolveTargetRef.current = opts.resolveTarget;

  usePinchGesture(canvasRef, (clientAnchor, scaleFactor) => {
    const el = canvasRef.current;
    if (!el) return;
    const target = resolveTargetRef.current?.(clientAnchor.x, clientAnchor.y) ?? null;
    let anchor: { x: number; y: number };
    if (target) {
      anchor = { x: clientAnchor.x - target.origin.left, y: clientAnchor.y - target.origin.top };
    } else {
      const [cx, cy] = clientToCanvas(el, clientAnchor.x, clientAnchor.y);
      anchor = { x: cx, y: cy };
    }
    const newView = zoomAt(target?.view ?? getViewRef.current(), anchor, scaleFactor, { min, max });
    (target ? target.setView : setViewRef.current)(newView);
  }, enabled);
}
