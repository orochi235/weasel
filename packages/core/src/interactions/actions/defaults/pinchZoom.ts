/**
 * `pinchZoomAction` — ongoing Action descriptor for two-finger pinch zoom
 * and pan. The id and label stay `pinchZoom` / `Pinch Zoom`.
 *
 * ## Status: REAL
 *
 * Implements pinch-zoom via the multi-touch pointer stream:
 *   - `start`: captures startSpread from `ctx.multiTouch.pinch.startSpread`
 *     (or falls back to `ctx.multiTouch.spread`). Records the initial centroid.
 *   - `onMove`: computes zoom factor = currentSpread / startSpread, anchors
 *     `zoomAt` on the previous centroid, then translates by the centroid
 *     delta. Together those pin the world point under the gesture midpoint
 *     as the midpoint moves, so the same gesture zooms and pans.
 *   - `onEnd`: no-op — zoom is already applied each frame.
 *
 * ## Dispatcher extensions required
 *
 * - `InvocationCtx.multiTouch.pinch`: the dispatcher
 *   populates it on every multitouch move-pump event. `startSpread` is
 *   captured once when the handle opens; `currentSpread` updates each frame.
 * - `InputEvent.multitouch.centroid / spread`:
 *   `useGestureDispatcher` synthesizes updated geometry on `pointermove`
 *   when a multitouch handle is in flight.
 *
 * ## Graceful degradation
 *
 * If `ctx.multiTouch.pinch` is absent (e.g. old dispatcher without these
 * extensions), `start` returns an empty handle — no-op, no crash.
 *
 * @see zoomAt — fixed-point zoom primitive from `core/viewport/zoomAt`.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { ViewApi } from '../depSchema';
import { zoomAt } from 'core/viewport/zoomAt';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface PinchScratch {
  view: ViewApi;
  startSpread: number;
  centroid: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Tuning for {@link makePinchZoomAction}.
 */
export interface PinchZoomOptions {
  /** Lower clamp on the resulting view scale, forwarded to `zoomAt`. Default 0.1. */
  min?: number;
  /** Upper clamp on the resulting view scale, forwarded to `zoomAt`. Default 8. */
  max?: number;
}

/**
 * @experimental
 * Build a `viewport.pinchZoom` Action descriptor with a configurable scale
 * clamp. The binding (two-finger multitouch) is fixed; only the clamp varies.
 *
 * Requires dep-schema entries: `view`.
 *
 * The invoker is `ongoing`. Zoom is applied per-frame via `view.set(zoomAt(...))`.
 */
// No `eligible` field → pinch zoom is always eligible across all modes.
export function makePinchZoomAction(
  opts: PinchZoomOptions = {},
): Action & { requires: string[] } {
  const clamp = { min: opts.min ?? 0.1, max: opts.max ?? 8 };
  return {
    id: 'viewport.pinchZoom',
    label: 'Pinch Zoom',
    group: 'viewport',
    defaultBinding: { kind: 'multiTouch', fingers: 2 },
    requires: ['view'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx, _opts): OngoingHandle {
        const view = ctx.deps.view as ViewApi | undefined;
        if (!view) return {};

        const multiTouch = ctx.multiTouch;
        if (!multiTouch) return {};

        // On start, spread comes from the initial multitouch event.
        // The pinch field may not be set yet on start (it's populated on moves).
        const startSpread = multiTouch.spread > 0 ? multiTouch.spread : 1;

        const scratch: PinchScratch = { view, startSpread, centroid: multiTouch.centroid };

        return {
          kind: 'pinch',
          onMove(moveCtx: InvocationCtx): void {
            const mt = moveCtx.multiTouch;
            if (!mt?.pinch) return;
            const { currentSpread, centroid } = mt.pinch;
            if (currentSpread <= 0 || scratch.startSpread <= 0) return;
            const factor = currentSpread / scratch.startSpread;
            // Update startSpread each frame so the factor is incremental.
            // This avoids drift accumulation across many frames.
            scratch.startSpread = currentSpread;
            const prev = scratch.centroid;
            scratch.centroid = centroid;
            const current = scratch.view.get();
            // Anchor the zoom on where the fingers *were*, then translate by how
            // far they travelled — together those pin the world point under the
            // centroid as it moves. Anchoring on the new centroid instead drops
            // the translation half, so a two-finger drag zooms without panning.
            const zoomed = zoomAt(current, prev, factor, clamp);
            scratch.view.set({
              scale: zoomed.scale,
              x: zoomed.x - (centroid.x - prev.x) / zoomed.scale.x,
              y: zoomed.y - (centroid.y - prev.y) / zoomed.scale.y,
            });
          },
          // onEnd: nothing to do — zoom was applied each frame.
        };
      },
    },
    enabled: () => true,
  };
}

/**
 * @experimental
 * Default `viewport.pinchZoom` descriptor: two-finger pinch with the kit's
 * default 0.1–8 scale clamp. Equivalent to `makePinchZoomAction()`.
 */
export const pinchZoomAction: Action & { requires: string[] } = makePinchZoomAction();
