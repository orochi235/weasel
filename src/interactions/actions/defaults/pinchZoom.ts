/**
 * `pinchZoomAction` — ongoing Action descriptor for two-finger pinch zoom.
 *
 * ## Status: REAL (Phase 14b)
 *
 * Implements pinch-zoom via the multi-touch pointer stream:
 *   - `start`: captures startSpread from `ctx.multiTouch.pinch.startSpread`
 *     (or falls back to `ctx.multiTouch.spread`). Records the initial centroid.
 *   - `onMove`: computes zoom factor = currentSpread / startSpread; applies
 *     `zoomAt(view, centroid, factor)` so the gesture midpoint stays fixed
 *     on screen.
 *   - `onEnd`: no-op — zoom is already applied each frame.
 *
 * ## Dispatcher extensions required (Phase 14b)
 *
 * - `InvocationCtx.multiTouch.pinch`: added in Phase 14b. The dispatcher
 *   populates it on every multitouch move-pump event. `startSpread` is
 *   captured once when the handle opens; `currentSpread` updates each frame.
 * - `InputEvent.multitouch.centroid / spread`: added in Phase 14b.
 *   `useGestureDispatcher` synthesizes updated geometry on `pointermove`
 *   when a multitouch handle is in flight.
 *
 * ## Graceful degradation
 *
 * If `ctx.multiTouch.pinch` is absent (e.g. old dispatcher without Phase 14b
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
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `viewport.pinchZoom` Action.
 *
 * Requires dep-schema entries: `view`.
 *
 * The invoker is `ongoing`. Zoom is applied per-frame via `view.set(zoomAt(...))`.
 */
export const pinchZoomAction: Action & { requires: string[] } = {
  id: 'viewport.pinchZoom',
  label: 'Pinch Zoom',
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

      const scratch: PinchScratch = { view, startSpread };

      return {
        onMove(moveCtx: InvocationCtx): void {
          const mt = moveCtx.multiTouch;
          if (!mt?.pinch) return;
          const { currentSpread, centroid } = mt.pinch;
          if (currentSpread <= 0 || scratch.startSpread <= 0) return;
          const factor = currentSpread / scratch.startSpread;
          // Update startSpread each frame so the factor is incremental.
          // This avoids drift accumulation across many frames.
          scratch.startSpread = currentSpread;
          const current = scratch.view.get();
          scratch.view.set(zoomAt(current, centroid, factor));
        },
        // onEnd: nothing to do — zoom was applied each frame.
      };
    },
  },
  enabled: () => true,
};
