import { IS_DEV } from './isDev';

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

export const COORD_DEV: boolean = IS_DEV;

export function recordCoordTrace(entry: CoordTraceEntry): void {
  if (!COORD_DEV) return;
  coordTrace.push(entry);
  if (coordTrace.length > COORD_TRACE_LIMIT) coordTrace.shift();
}
