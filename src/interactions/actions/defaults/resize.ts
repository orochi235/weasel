/**
 * `resizeAction` — ongoing Action descriptor for anchor-relative drag resize (Phase 11).
 *
 * ## Status: PARTIAL — guards real, invoker body deferred
 *
 * The descriptor now has real selection + scene guards and can be dispatched
 * to without error, but the per-frame resize math is NOT wired. The invoker
 * returns `{}` (empty handle) when dispatched. This matches the previous stub
 * but adds honest guards so the descriptor is "as real as it can be" without
 * handle classification.
 *
 * ## Why not REAL
 *
 * To resize correctly the invoker needs:
 *
 * 1. **`anchor: ResizeAnchor`** — which handle (TL, TR, BL, BR, edge) was
 *    grabbed. The dispatcher does not yet thread this through `InvocationCtx`.
 *    Without it the invoker cannot know which corner is fixed vs dragged.
 *
 * 2. **Typed `PoseDescriptor<TPose>`** — to project drag delta into bounds
 *    space and back into pose space (via `getBounds` + `remapBounds`).
 *    `InvocationCtx` / `DepSchema` do not carry a typed geometry surface.
 *
 * ## Path to REAL
 *
 * - Phase 12 TODO: add `InvocationCtx.resizeAnchor?: ResizeAnchor` field.
 *   The dispatcher populates it from the chrome affordance that initiated the
 *   gesture (corner handle element tag → anchor classification).
 * - Phase 12 TODO: add a `DepSchema` entry for `PoseDescriptor` (or a
 *   geometry-aware scene surface). Then the invoker body can mirror
 *   `useResize.move`'s anchor-relative bounds math + `scene.batch('Resize', ...)`.
 *
 * ## What IS real
 *
 * - Selection + scene guards: the invoker bails with `{}` when either dep is
 *   missing or the selection is empty.
 * - The descriptor structure (id, label, gestureBinding, requires, timing) is
 *   correct and registered. The dispatcher can route `resize` events to it;
 *   they will silently produce no effect until Phase 12 wires the body.
 *
 * @see useResize — the React hook this descriptor will mirror.
 * @see src/interactions/actions/resize/geometry.ts — `PoseDescriptor` and anchor math.
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `resize` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * The invoker is `ongoing` and performs real selection + scene guards, but
 * the resize math body is deferred to Phase 12 (requires `resizeAnchor` in
 * `InvocationCtx` and a `PoseDescriptor` dep).
 */
export const resizeAction: Action & { requires: string[] } = {
  id: 'resize',
  label: 'Resize',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;

      // Guard: missing deps → bail.
      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      // Guard: empty selection → bail.
      if (ids.length === 0) return {};

      // Guard: no anchor information in InvocationCtx → bail.
      // TODO (Phase 12): replace with real anchor-relative bounds math once
      // `InvocationCtx.resizeAnchor` is populated by the dispatcher.
      // The invoker intentionally returns `{}` here rather than attempting
      // a guess — a wrong anchor silently produces incorrect resize behavior,
      // whereas `{}` is a safe no-op.
      return {};
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
