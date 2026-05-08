import { useRef } from 'react';
import { usePinchGesture } from '../../features/viewport/usePinchGesture';
import { zoomAt } from '../../features/viewport/zoomAt';
import { clientToCanvas } from '../../features/viewport/clientToCanvas';
import type { View } from '../../features/viewport/view';

export interface PinchZoomToolOpts {
  min?: number;
  max?: number;
}

/**
 * Two-finger pinch zoom on the canvas. Standalone hook (not a Tool record)
 * because it requires direct multi-pointer access on the canvas element.
 *
 * The anchor point under the gesture midpoint stays fixed on screen as the
 * view scales.
 */
export function usePinchZoomTool(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  view: View,
  setView: (v: View) => void,
  opts: PinchZoomToolOpts = {},
) {
  const viewRef = useRef(view);
  viewRef.current = view;
  const setViewRef = useRef(setView);
  setViewRef.current = setView;
  const { min = 0.1, max = 8 } = opts;

  usePinchGesture(canvasRef, (clientAnchor, scaleFactor) => {
    const el = canvasRef.current;
    if (!el) return;
    const [cx, cy] = clientToCanvas(el, clientAnchor.x, clientAnchor.y);
    const newView = zoomAt(viewRef.current, { x: cx, y: cy }, scaleFactor, { min, max });
    setViewRef.current(newView);
  });
}
