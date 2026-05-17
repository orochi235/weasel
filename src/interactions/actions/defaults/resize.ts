/**
 * `resizeAction` — ongoing Action descriptor for anchor-relative drag resize (Phase 7).
 *
 * ## Status: STUBBED — Phase 7 shape only
 *
 * The descriptor is registered and structurally correct. The invoker.start
 * body is a deliberate no-op stub. Full wiring is deferred to Phase 8+.
 *
 * ## Why stubbed
 *
 * `useResize` drives resize through a rich pipeline:
 *   - Per-frame anchor-relative bounds math (unrotated and rotated paths)
 *   - `PoseDescriptor<TPose>` geometry projection (getBounds / remapBounds)
 *   - `ResizeBehavior` pipeline (lock-aspect, snap, clamp, etc.)
 *   - `PointSnapBehavior` world-frame back-solve pipeline
 *   - Group expansion via `expandIds` + union-AABB re-mapping
 *   - Rotation correction (fixed-world-corner pinning)
 *
 * This pipeline requires: (a) a typed `PoseDescriptor` the descriptor cannot
 * carry generically; (b) an `anchor: ResizeAnchor` that the dispatcher does
 * not yet pass through `InvocationCtx`; (c) an expanded ids list the hook
 * derives from `expandIds(ids)`. None of these are available in the Phase 7
 * `InvocationCtx` / `DepRegistry` surface.
 *
 * TODO: Phase 8+ wires the invoker body — currently a no-op stub.
 * Expected additions:
 * - `InvocationCtx.resizeAnchor?: ResizeAnchor` field from the dispatcher
 * - `DepRegistry` entry for a `PoseDescriptor` (or a geometry-aware scene)
 * - Invoker body mirrors `useResize.start/move/end` via scene.batch
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `resize` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * The invoker is `ongoing` but the body is a no-op stub pending Phase 8
 * dispatcher additions (anchor delivery, typed geometry).
 *
 * @see useResize — the React hook this descriptor will mirror.
 */
export const resizeAction: Action & { requires: string[] } = {
  id: 'resize',
  label: 'Resize',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    start(_ctx: InvocationCtx, _opts): OngoingHandle {
      // TODO: Phase 8+ wires the invoker body — currently a no-op stub.
      // Requires InvocationCtx.resizeAnchor and a typed PoseDescriptor dep.
      return {};
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
