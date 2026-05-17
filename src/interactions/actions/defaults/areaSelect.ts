/**
 * `areaSelectAction` — ongoing Action descriptor for marquee area selection (Phase 7).
 *
 * ## Status: STUBBED — Phase 7 shape only
 *
 * The descriptor is registered and structurally correct. The invoker.start
 * body is a deliberate no-op stub. Full wiring is deferred to Phase 8+.
 *
 * ## Why stubbed
 *
 * `useAreaSelect` drives area selection through:
 *   - `useDragRect` for the live marquee rectangle (start + move + end)
 *   - `AreaSelectBehavior` pipeline: behaviors receive `GestureContext<AreaSelectPose>`
 *     and emit Ops on `onEnd` (e.g. `selectFromMarquee`)
 *   - Shift-held state captured at gesture START and threaded through onMove
 *   - `AreaSelectAdapter.applyOps` for final op dispatch (transient or batched)
 *
 * The key gap: the Action descriptor's invoker works with `InvocationCtx.drag`
 * (cumulative delta from dispatcher), while `useAreaSelect` needs two absolute
 * world-space points (start and current) to render the marquee rectangle. The
 * dispatcher provides `drag.start` and `drag.current` in `InvocationCtx`, but
 * the behavior pipeline also requires an `AreaSelectAdapter` that is currently
 * not part of the `DepRegistry` surface.
 *
 * Additionally, the selection-write path goes through `adapter.applyOps`, not
 * `scene.batch`, so the dep model needs an `areaSelectAdapter` or equivalent.
 *
 * TODO: Phase 8+ wires the invoker body — currently a no-op stub.
 * Expected additions:
 * - `DepRegistry` entry for `AreaSelectAdapter` (or a `selectNodes` scene surface)
 * - Invoker body mirrors `useAreaSelect` drag-rect / behavior pipeline
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `areaSelect` Action.
 *
 * Requires dep-schema entry: `selection`.
 * (No `scene` dep at this phase — selection writes go through an adapter.)
 *
 * The invoker is `ongoing` but the body is a no-op stub pending Phase 8
 * dispatcher additions (AreaSelectAdapter dep, marquee world-point delivery).
 *
 * @see useAreaSelect — the React hook this descriptor will mirror.
 */
export const areaSelectAction: Action & { requires: string[] } = {
  id: 'areaSelect',
  label: 'Area Select',
  gestureBinding: { kind: 'drag' },
  requires: ['selection'],
  invoker: {
    timing: 'ongoing',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    start(_ctx: InvocationCtx, _opts): OngoingHandle {
      // TODO: Phase 8+ wires the invoker body — currently a no-op stub.
      // Requires an AreaSelectAdapter dep and marquee world-point delivery
      // through InvocationCtx.drag.start / drag.current.
      return {};
    },
  },
  /**
   * Area select doesn't require a pre-existing selection — it creates one.
   * Return `SelectionRequired` as the static placeholder to satisfy the
   * `Action.enabled` contract; the invoker would self-guard at runtime.
   */
  enabled: () => ActionDisabledReason.SelectionRequired,
};
