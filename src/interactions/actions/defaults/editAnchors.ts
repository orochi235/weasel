/**
 * `editAnchorsAction` — ongoing Action descriptor for editing polygon anchors (Phase 7.5).
 *
 * ## Status: STUBBED — Phase 7.5 shape only
 *
 * The descriptor is registered and structurally correct. The invoker.start
 * body is a deliberate no-op stub. Full wiring is deferred to Phase 8+.
 *
 * ## Why stubbed
 *
 * `useEditAnchors` drives anchor editing through a multi-phase gesture:
 *   - Hit-testing the polygon anchors or control handles
 *   - Per-frame anchor/control coordinate update via `withCoord`
 *   - Undo-safe commit via `createTransformOp`
 *   - Support for shift-selection of multiple anchors (deferred)
 *
 * This pipeline requires: (a) a dispatcher-level anchor-hit result in
 * `InvocationCtx`; (b) a way to dispatch the edit mode (which polygon is being
 * edited); (c) access to the full polygon geometry via the scene dep. None of
 * these are available in the Phase 7 `InvocationCtx` / `DepRegistry` surface.
 *
 * Additionally, anchor editing is typically driven by a modal UI (an overlay
 * showing editable handles), not a keystroke. The action framework currently
 * assumes actions are keystroke-triggered or toolbar-driven, not modal-state-driven.
 *
 * TODO: Phase 8+ wires the invoker body — currently a no-op stub.
 * Expected additions:
 * - `InvocationCtx.anchorHit?: { id: string; hit: AnchorHit }` from dispatcher
 * - Modal overlay control — dispatch edit mode on start
 * - Polygon geometry access via typed `scene` dep
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `editAnchors` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * The invoker is `ongoing` but the body is a no-op stub pending Phase 8
 * dispatcher additions (anchor hit delivery, modal overlay control).
 *
 * @see useEditAnchors — the React hook this descriptor will mirror.
 */
export const editAnchorsAction: Action & { requires: string[] } = {
  id: 'editAnchors',
  label: 'Edit Anchors',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    start(_ctx: InvocationCtx, _opts): OngoingHandle {
      // TODO: Phase 8+ wires the invoker body — currently a no-op stub.
      // Requires InvocationCtx.anchorHit and modal overlay control.
      return {};
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
