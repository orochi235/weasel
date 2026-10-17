import type { View } from 'core/viewport/view';
import { isDev } from '@weasel-js/react';

// ---------------------------------------------------------------------------
// Dev-only coord trace
// ---------------------------------------------------------------------------

/** Records every `clientToWorld` call so dev tools (and agents) can
 *  reconcile cursor coords with computed world coords. Mirrors the
 *  dispatcher's trace log. Exposed on `window.__weaselCoordLog__`. */
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

export const COORD_TRACE_LIMIT = 200;

export const coordTrace: CoordTraceEntry[] = [];

export const COORD_DEV: boolean = isDev();

if (COORD_DEV && typeof window !== 'undefined') {
  (window as unknown as { __weaselCoordLog__: CoordTraceEntry[] }).__weaselCoordLog__ = coordTrace;
}

function recordCoordTrace(entry: CoordTraceEntry): void {
  if (!COORD_DEV) return;
  coordTrace.push(entry);
  if (coordTrace.length > COORD_TRACE_LIMIT) coordTrace.shift();
}

/** Record one conversion against the rect and view it was made under. A null
 *  `canvas` or a missing `view` records the identity fallback. */
export function traceConversion(
  clientX: number,
  clientY: number,
  canvas: HTMLElement | null,
  view: View | null | undefined,
  world: { x: number; y: number },
): void {
  if (!COORD_DEV) return;
  if (!canvas || !view) {
    recordCoordTrace({ ts: Date.now(), clientX, clientY, rect: null, view: null, world, fallback: true });
    return;
  }
  const rect = canvas.getBoundingClientRect();
  recordCoordTrace({
    ts: Date.now(), clientX, clientY,
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    view: { x: view.x, y: view.y, scaleX: view.scale.x, scaleY: view.scale.y },
    world, fallback: false,
  });
}
