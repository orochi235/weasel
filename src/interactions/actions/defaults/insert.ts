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
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { resolveParams } from '../invoker';
import type { InsertDep, InsertExtras } from '../depSchema';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface InsertScratch {
  dep: InsertDep;
  /** The active binding's opts — re-resolved at commit time so thunked
   *  params see the latest tool state (e.g. polygon `sides` after ArrowUp). */
  opts: BindingOpts | undefined;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  /** Pointer trail accumulated by the dispatcher in world space. Same array
   *  reference as `ctx.drag.points`; pencil-kind commits read from this. */
  points: ReadonlyArray<{ x: number; y: number }> | null;
}

/** Build a typed `InsertExtras` from the static params + gesture context.
 *  Kit-built-in kinds (line / polygon / star / pencil) read kind-specific
 *  fields; unknown kinds pass the raw params through as `{ kind, ... }`. */
function buildExtras(
  params: Record<string, unknown> | undefined,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  points: ReadonlyArray<{ x: number; y: number }> | null,
): InsertExtras {
  const kind = ((params?.['kind'] as string | undefined) ?? 'rect');
  switch (kind) {
    case 'rect':
    case 'ellipse':
      return { kind } as InsertExtras;
    case 'line':
      // Use the live drag endpoints (not AABB) so the line preserves the
      // user's drag direction — drag from bottom-left to top-right makes a
      // line that slopes up, not the bounds diagonal.
      return { kind: 'line', a: { x: startX, y: startY }, b: { x: currentX, y: currentY } };
    case 'polygon': {
      const sides = Number(params?.['sides'] ?? 6);
      const rotation = Number(params?.['rotation'] ?? 0);
      const extras: InsertExtras = { kind: 'polygon', sides, rotation };
      if (params?.['center'] !== undefined) (extras as { center?: unknown }).center = params['center'];
      if (params?.['radius'] !== undefined) (extras as { radius?: unknown }).radius = params['radius'];
      return extras;
    }
    case 'star': {
      const pts = Number(params?.['points'] ?? 5);
      const ir = Number(params?.['innerRadiusRatio'] ?? 0.5);
      const rotation = Number(params?.['rotation'] ?? 0);
      const extras: InsertExtras = { kind: 'star', points: pts, innerRadiusRatio: ir, rotation };
      if (params?.['center'] !== undefined) (extras as { center?: unknown }).center = params['center'];
      if (params?.['outerRadius'] !== undefined) (extras as { outerRadius?: unknown }).outerRadius = params['outerRadius'];
      return extras;
    }
    case 'pencil':
      // Prefer tool-supplied samples (param) when present — pencil tools may
      // capture richer per-sample data (pressure/tilt). Fall back to the
      // dispatcher's accumulated pointer trail.
      return {
        kind: 'pencil',
        samples: (params?.['samples'] as ReadonlyArray<{ x: number; y: number }> | undefined)
          ?? points
          ?? [],
      };
    default:
      // Consumer-defined kind: pass everything through so a custom insert
      // dep can read its own fields.
      return { ...(params ?? {}), kind } as InsertExtras;
  }
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

      const scratch: InsertScratch = {
        dep,
        opts,
        startX: ctx.world.x,
        startY: ctx.world.y,
        currentX: ctx.world.x,
        currentY: ctx.world.y,
        points: ctx.drag?.points ?? null,
      };

      return {
        onMove(moveCtx: InvocationCtx): void {
          scratch.currentX = moveCtx.world.x;
          scratch.currentY = moveCtx.world.y;
          // The dispatcher mutates its own per-gesture trail in place but
          // attaches the array reference to each InvocationCtx.drag — keep
          // the latest reference in case the dispatcher swaps it.
          if (moveCtx.drag?.points) scratch.points = moveCtx.drag.points;
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') return;

          const { dep: d, opts: o, startX, startY, currentX, currentY } = scratch;
          const points = endCtx.drag?.points ?? scratch.points;

          const x = Math.min(startX, currentX);
          const y = Math.min(startY, currentY);
          const width = Math.abs(currentX - startX);
          const height = Math.abs(currentY - startY);

          // Resolve params at commit time so thunked params (polygon
          // `sides` adjusted mid-drag, etc.) see the latest tool state.
          const resolved = resolveParams(o?.params);
          const extras = buildExtras(resolved, startX, startY, currentX, currentY, points);

          // Sub-threshold drag — no insert. Exception: pencil with a real
          // sample trail can still produce a meaningful path even when the
          // start ≈ end (e.g. a closed loop).
          if ((width === 0 || height === 0) && extras.kind !== 'pencil') return;

          d.commit({ x, y, width, height }, extras);
        },
      };
    },
  },
  /**
   * Insert is always available — no selection required. Returns `true` so the
   * dispatcher allows the action through on every drag-on-empty gesture.
   *
   * Phase 14c.2: fixed from the stale `ActionDisabledReason.SelectionRequired`
   * placeholder that was silently blocking all dispatcher-routed inserts.
   */
  enabled: () => true as const,
};
