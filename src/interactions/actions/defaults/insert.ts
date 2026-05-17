/**
 * `insertAction` — ongoing Action descriptor for drag-to-insert (Phase 11).
 *
 * ## Status: REAL
 *
 * Implements the drag-rect insert logic from `useInsert`:
 *   - `start`: validates the `insert` dep and records the drag start point.
 *   - `onMove`: tracks the live drag bounds (no scene writes).
 *   - `onEnd('commit')`: derives final bounds from drag.start + drag.current;
 *     calls `deps.insert.commit(bounds, kind)` to materialise the new node.
 *     `kind` comes from `opts.params.kind` (set by the active tool's binding).
 *   - `onEnd('cancel')`: no-op.
 *
 * ## Dependencies
 *
 * Requires `insert` dep from DepSchema (Phase 11 addition):
 *   `{ commit(bounds, kind): NodeId | null }`
 *
 * `<SceneCanvas>` / `<StandardActionsRegistrar>` should source this dep by
 * delegating to the scene's `add()` with a sensible default data payload for
 * the given `kind`. Override per-consumer for custom node factories.
 *
 * ## What this does NOT wire (vs `useInsert`)
 *
 * - `InsertBehavior` pipeline (snap, etc.) — deferred to a later phase.
 * - `pointInsert` fallback for click / sub-threshold drags — not wired; a
 *   sub-threshold drag produces no insert.
 * - Live insert overlay — deferred to Phase 7 overlay surface.
 * - `clickOnly` mode — not applicable to the descriptor model.
 *
 * ## Relationship to `useInsert`
 *
 * `useInsert` calls `adapter.commitInsert(bounds)` which returns a node and
 * dispatches a `createInsertOp`. This descriptor delegates to `deps.insert.commit`
 * which encapsulates both factory + op dispatch in one call. This keeps the
 * dep contract thin and avoids importing `createInsertOp` into the descriptor.
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import type { InsertDep } from '../depSchema';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface InsertScratch {
  dep: InsertDep;
  kind: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `insert` Action.
 *
 * Requires dep-schema entry: `insert`.
 * Node `kind` is read from `opts.params.kind`; defaults to `'rect'` when absent.
 *
 * @see useInsert — the React hook this descriptor mirrors for the simple case.
 */
export const insertAction: Action & { requires: string[] } = {
  id: 'insert',
  label: 'Insert',
  gestureBinding: { kind: 'drag' },
  requires: ['insert'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const dep = ctx.deps.insert as InsertDep | undefined;
      if (!dep) return {};

      // `kind` flows from the binding's params — the active tool wires this
      // when registering the binding. Default to 'rect' as a safe fallback.
      const kind = (opts?.params?.['kind'] as string | undefined) ?? 'rect';

      const scratch: InsertScratch = {
        dep,
        kind,
        startX: ctx.world.x,
        startY: ctx.world.y,
        currentX: ctx.world.x,
        currentY: ctx.world.y,
      };

      return {
        onMove(moveCtx: InvocationCtx): void {
          scratch.currentX = moveCtx.world.x;
          scratch.currentY = moveCtx.world.y;
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') return;

          const { dep: d, kind: k, startX, startY, currentX, currentY } = scratch;

          const x = Math.min(startX, currentX);
          const y = Math.min(startY, currentY);
          const width = Math.abs(currentX - startX);
          const height = Math.abs(currentY - startY);

          // Sub-threshold drag — no insert.
          if (width === 0 || height === 0) return;

          d.commit({ x, y, width, height }, k);
        },
      };
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
