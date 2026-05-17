/**
 * `lassoSelectAction` — ongoing Action descriptor for polygon lasso selection (Phase 7.5).
 *
 * ## Status: STUBBED — Phase 7.5 shape only
 *
 * The descriptor is registered and structurally correct. The invoker.start
 * body is a deliberate no-op stub. Full wiring is deferred to Phase 8+.
 *
 * ## Why stubbed
 *
 * `useLassoSelect` drives selection through:
 *   - Per-pointermove vertex collection (world-space polygon building)
 *   - `LassoSelectBehavior` callbacks (onStart, onMove, onEnd)
 *   - Hit-test + selection ops applied via behaviors
 *   - Transient vs. committed history modes
 *
 * This pipeline requires: (a) full pointermove stream access to build the
 * polygon vertex list; (b) dispatch callbacks to behaviors on every move
 * (not just the final end-of-drag result); (c) access to the full selection
 * state + adapter for hit-testing and mutation. The current `InvocationCtx`
 * only carries the final drag bounds, not the raw pointer stream or per-move
 * vertex data.
 *
 * TODO: Phase 8+ wires the invoker body — currently a no-op stub.
 * Expected additions:
 * - Full pointermove stream in `InvocationCtx` (or a separate stream subscription)
 * - Per-move dispatch mechanism for `LassoSelectBehavior` callbacks
 * - `InvocationCtx` carry-through of behavior results
 * - Transient selection mode control
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `lassoSelect` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * The invoker is `ongoing` but the body is a no-op stub pending Phase 8
 * dispatcher additions (full pointer stream, per-move behavior dispatch).
 *
 * @see useLassoSelect — the React hook this descriptor will mirror.
 */
export const lassoSelectAction: Action & { requires: string[] } = {
  id: 'lassoSelect',
  label: 'Lasso Select',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    start(_ctx: InvocationCtx, _opts): OngoingHandle {
      // TODO: Phase 8+ wires the invoker body — currently a no-op stub.
      // Requires full pointermove stream and per-move behavior dispatch.
      return {};
    },
  },
  enabled: () => true,
};
