/**
 * `rotateAction` — ongoing Action descriptor for pointer-driven rotation (Phase 7).
 *
 * ## Status: STUBBED — Phase 7 shape only
 *
 * The descriptor is registered and structurally correct. The invoker.start
 * body is a deliberate no-op stub. Full wiring is deferred to Phase 8+.
 *
 * ## Why stubbed
 *
 * `useRotate` drives rotation through:
 *   - Per-item angle delta math (pointer angle around the union AABB center)
 *   - `RotateGeometry<TPose>` projection (getRotatedBounds / withRotation)
 *   - Shift-snap: final rotation snapped to nearest 15° per-item
 *   - Union-pivot orbit math for multi-item gestures
 *   - `RotateBehavior` pipeline
 *
 * The angle delta requires the drag START pointer position to compute the
 * angle, and a per-item pivot derived from AABB centers read from the adapter.
 * Phase 7 `InvocationCtx.drag.start` carries the start world point, but the
 * pivot (AABB center) is typed to a `RotateAdapter` rather than the generic
 * `scene` dep. Wiring without that adapter would silently produce a wrong
 * pivot.
 *
 * TODO: Phase 8+ wires the invoker body — currently a no-op stub.
 * Expected additions:
 * - `RotateGeometry` dep or scene-level `getCenterOf(id)` surface
 * - `DepRegistry` entry for `RotateAdapter` (or typed `scene`)
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `rotate` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * The invoker is `ongoing` but the body is a no-op stub pending Phase 8
 * dispatcher additions (typed geometry / RotateAdapter dep).
 *
 * @see useRotate — the React hook this descriptor will mirror.
 */
export const rotateAction: Action & { requires: string[] } = {
  id: 'rotate',
  label: 'Rotate',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    start(_ctx: InvocationCtx, _opts): OngoingHandle {
      // TODO: Phase 8+ wires the invoker body — currently a no-op stub.
      // Requires RotateGeometry dep and pivot derivation from AABB centers.
      return {};
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
