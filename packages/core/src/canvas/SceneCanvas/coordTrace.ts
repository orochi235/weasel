import type { TraceRing } from '@weasel-js/routing';
import type { View } from 'core/viewport/view';

/** One `clientToWorld` call, so a cursor position can be reconciled with the
 *  world point it became. A canvas keeps these beside its dispatch trace, and
 *  the devtools hook's `get-trace` reads them. */
export interface CoordTraceEntry {
  ts: number;
  clientX: number;
  clientY: number;
  rect: { left: number; top: number; width: number; height: number } | null;
  view: { x: number; y: number; scaleX: number; scaleY: number } | null;
  world: { x: number; y: number };
  /** True when canvas/view weren't available and we returned identity. */
  fallback: boolean;
}

/** Record one conversion against the rect and view it was made under. A null
 *  `canvas` or a missing `view` records the identity fallback. */
export function traceConversion(
  ring: TraceRing<CoordTraceEntry>,
  clientX: number,
  clientY: number,
  canvas: HTMLElement | null,
  view: View | null | undefined,
  world: { x: number; y: number },
): void {
  if (!ring.recording()) return;
  if (!canvas || !view) {
    ring.push({ ts: Date.now(), clientX, clientY, rect: null, view: null, world, fallback: true });
    return;
  }
  const rect = canvas.getBoundingClientRect();
  ring.push({
    ts: Date.now(), clientX, clientY,
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    view: { x: view.x, y: view.y, scaleX: view.scale.x, scaleY: view.scale.y },
    world, fallback: false,
  });
}
