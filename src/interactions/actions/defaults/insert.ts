/**
 * `insertAction` — ongoing Action descriptor for drag-to-insert (Phase 7).
 *
 * ## Status: STUBBED — Phase 7 shape only
 *
 * The descriptor is registered and structurally correct. The invoker.start
 * body is a deliberate no-op stub. Full wiring is deferred to Phase 8+.
 *
 * ## Why stubbed
 *
 * `useInsert` drives insertion through:
 *   - `useDragRect` for the live marquee (bounds) rectangle
 *   - `InsertBehavior<TPose>` pipeline: behaviors receive `GestureContext<TPose>`
 *   - `adapter.commitInsert(bounds)` to materialize the new node on commit
 *   - `pointInsert` fallback for click / sub-threshold drags
 *   - `InsertOp` creation via `createInsertOp` → dispatch via `applyBatch`
 *
 * The key gaps for the descriptor model:
 * 1. The factory for the new node type (what gets inserted) is consumer-provided
 *    via the adapter or `pointInsert` — there is no generic way to encode this
 *    in a descriptor without a typed dep.
 * 2. `adapter.commitInsert` is typed `InsertAdapter<TNode>` which is not part
 *    of the current `DepRegistry` surface.
 * 3. The active tool context governs what kind of node to insert — the
 *    descriptor would need to read `deps.activeTool` to dispatch to the right
 *    factory, but no such contract exists yet.
 *
 * TODO: Phase 8+ wires the invoker body — currently a no-op stub.
 * Expected additions:
 * - `DepRegistry` entry for an `InsertAdapter` or `nodeFactory` dep
 * - `deps.activeTool` contract for factory selection
 * - Invoker body mirrors `useInsert` drag-rect / adapter path
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `insert` Action.
 *
 * Requires dep-schema entry: `activeTool`.
 * (`selection` and `scene` are not consumed at insert time — the new node
 *  is materialized through a factory/adapter which Phase 8 will add as a dep.)
 *
 * The invoker is `ongoing` but the body is a no-op stub pending Phase 8
 * dispatcher additions (InsertAdapter dep, factory selection via activeTool).
 *
 * @see useInsert — the React hook this descriptor will mirror.
 */
export const insertAction: Action & { requires: string[] } = {
  id: 'insert',
  label: 'Insert',
  gestureBinding: { kind: 'drag' },
  requires: ['activeTool'],
  invoker: {
    timing: 'ongoing',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    start(_ctx: InvocationCtx, _opts): OngoingHandle {
      // TODO: Phase 8+ wires the invoker body — currently a no-op stub.
      // Requires an InsertAdapter dep and an active-tool factory selection
      // contract to know what node type to create on commit.
      return {};
    },
  },
  /**
   * Insert is always available (no selection required). Return
   * `SelectionRequired` as the static placeholder only because `Action.enabled`
   * has no `'none'` / always-enabled sentinel yet.
   *
   * Phase 8 TODO: add `ActionDisabledReason.None` or `true` return path.
   */
  enabled: () => ActionDisabledReason.SelectionRequired,
};
