import { useEffect, useRef } from 'react';

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Detects two-finger pinch on a canvas element.
 *
 * @param onPinch Called with the gesture midpoint in **client coordinates** and
 *   a per-frame scale factor (ratio of current distance to previous frame's
 *   distance, not cumulative from gesture start). With 3+ fingers, the first
 *   two by insertion order are tracked.
 */
export function usePinchGesture(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onPinch: (anchor: { x: number; y: number }, scaleFactor: number) => void,
  enabled = true,
) {
  const onPinchRef = useRef(onPinch);
  onPinchRef.current = onPinch;

  useEffect(() => {
    if (!enabled) return;
    const el = canvasRef.current;
    if (!el) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let startDist: number | null = null;

    function getTwo(): [{ x: number; y: number }, { x: number; y: number }] | null {
      const vals = [...pointers.values()];
      if (vals.length < 2) return null;
      return [vals[0], vals[1]];
    }

    function onDown(e: PointerEvent) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const two = getTwo();
      if (two) startDist = dist(two[0], two[1]);
    }
    function onMove(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const two = getTwo();
      if (!two || startDist === null) return;
      const currentDist = dist(two[0], two[1]);
      const anchor = mid(two[0], two[1]);
      const factor = currentDist / startDist;
      startDist = currentDist;  // delta-based: reset each frame
      onPinchRef.current(anchor, factor);
    }
    function onUp(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) {
        startDist = null;
      } else {
        // Recompute startDist from the new active pair so the next move
        // doesn't compute scaleFactor against a stale baseline
        const two = getTwo();
        if (two) startDist = dist(two[0], two[1]);
      }
    }

    el.addEventListener('pointerdown', onDown as EventListener);
    el.addEventListener('pointermove', onMove as EventListener);
    el.addEventListener('pointerup', onUp as EventListener);
    el.addEventListener('pointercancel', onUp as EventListener);
    return () => {
      el.removeEventListener('pointerdown', onDown as EventListener);
      el.removeEventListener('pointermove', onMove as EventListener);
      el.removeEventListener('pointerup', onUp as EventListener);
      el.removeEventListener('pointercancel', onUp as EventListener);
    };
  }, [canvasRef, enabled]);
}
