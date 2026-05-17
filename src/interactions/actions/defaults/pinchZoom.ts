/**
 * `pinchZoomAction` — ongoing Action descriptor for two-finger pinch zoom (Phase 7.5).
 *
 * ## Status: STUBBED — Phase 7.5 shape only
 *
 * The descriptor is registered and structurally correct. The invoker.start
 * body is a deliberate no-op stub. Full wiring is deferred to Phase 8+.
 *
 * ## Why stubbed
 *
 * `usePinchZoomTool` drives viewport zoom through:
 *   - Multi-touch pointer tracking (two fingers simultaneously)
 *   - Per-touchmove scale-factor computation (distance ratio)
 *   - View scale clamping (min/max bounds)
 *   - Fixed-point zoom (anchor point under the gesture midpoint stays fixed on screen)
 *
 * This pipeline requires: (a) access to the raw multi-touch pointer events (not
 * just the final drag bounds); (b) per-move dispatch mechanism to compute and
 * apply scale; (c) view mutation via `ctx.setView`. The current `InvocationCtx`
 * only carries single-pointer drag bounds, not multi-touch stream state.
 *
 * Additionally, pinch-zoom is typically triggered by a canvas-native gesture
 * (multi-touch), not a keystroke or toolbar button. The action framework
 * currently assumes actions are keystroke-triggered or toolbar-driven.
 *
 * TODO: Phase 8+ wires the invoker body — currently a no-op stub.
 * Expected additions:
 * - Full multi-touch pointer stream in `InvocationCtx` (or separate stream subscription)
 * - Per-move scale-factor computation
 * - Direct `ctx.setView` call with scaled view bounds
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `viewport.pinchZoom` Action.
 *
 * Requires dep-schema entries: `view`.
 *
 * The invoker is `ongoing` but the body is a no-op stub pending Phase 8
 * dispatcher additions (multi-touch stream, per-move scale computation).
 *
 * @see usePinchZoomTool — the React hook this descriptor will mirror.
 */
export const pinchZoomAction: Action & { requires: string[] } = {
  id: 'viewport.pinchZoom',
  label: 'Pinch Zoom',
  gestureBinding: { kind: 'pinch' },
  requires: ['view'],
  invoker: {
    timing: 'ongoing',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    start(_ctx: InvocationCtx, _opts): OngoingHandle {
      // TODO: Phase 8+ wires the invoker body — currently a no-op stub.
      // Requires multi-touch pointer stream and per-move scale-factor computation.
      return {};
    },
  },
  enabled: () => ActionDisabledReason.None,
};
