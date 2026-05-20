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
 * ## Live preview
 *
 * Insert produces a brand-new node that has no scene id until commit, so
 * the preview-ghost layer (`usePreviewGhostLayer`, keyed by node id) can't
 * paint a silhouette for it. Instead, the action exposes its in-flight
 * geometry via the `overlay()` surface with `kind: 'insertPreview'`. The
 * canvas's `useDispatcherOverlayLayer` rebuilds the shape using the same
 * path builders the commit-time factory uses (`rectPath`, `ellipsePath`,
 * `linePath`, `regularPolygonPath`, `starPath`, polyline / `polygonFromPoints`),
 * so the preview is geometry-faithful to the eventual node.
 *
 * Consumer-defined insert kinds (kinds the kit doesn't know how to draw)
 * skip the preview but still commit normally on release.
 *
 * ## Relationship to `useInsert`
 *
 * `useInsert` calls `adapter.commitInsert(bounds)` which returns a node and
 * dispatches a `createInsertOp`. This descriptor delegates to `deps.insert.commit`
 * which encapsulates both factory + op dispatch in one call. This keeps the
 * dep contract thin and avoids importing `createInsertOp` into the descriptor.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts, OngoingOverlay } from '../invoker';
import { resolveParams } from '../invoker';
import type { InsertDep, InsertExtras } from '../depSchema';

/** The kit's built-in insert kinds — those the dispatcher overlay layer
 *  knows how to render. Consumer-defined kinds fall through to `null`
 *  (no live preview, but commit still works). */
const KIT_INSERT_KINDS = new Set([
  'rect', 'ellipse', 'line', 'polygon', 'star', 'pencil',
]);

type KitInsertShape = 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'pencil';

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
  /** Live Alt-key state from the most recent pump event. Alt INVERTS the
   *  binding's nominal `originMode` (corner → center and vice versa), so
   *  the user can press / release Alt mid-drag and the preview/commit
   *  flip without needing the dispatcher to re-route to a different
   *  binding. Captured per-onMove from `ctx.modifiers.alt`. */
  altHeld: boolean;
  /** Cleared once `onEnd` runs so subsequent `overlay()` calls report no
   *  in-flight preview (mirrors the areaSelect/lasso convention). */
  open: boolean;
}

/** Resolve the effective origin mode from the binding's nominal opt and
 *  live Alt state. Alt inverts: `corner` ⇄ `center`. */
function effectiveOriginMode(
  paramsOrigin: unknown,
  altHeld: boolean,
): 'corner' | 'center' {
  const nominal: 'corner' | 'center' = paramsOrigin === 'center' ? 'center' : 'corner';
  if (!altHeld) return nominal;
  return nominal === 'center' ? 'corner' : 'center';
}

/** Compute the insert AABB from drag endpoints.
 *  - `'corner'` (default): bounds = drag rect (top-left → bottom-right of cursor sweep).
 *  - `'center'`: bounds = symmetric AABB anchored on the start point.
 *    Used when the tool's Alt-modifier binding passes
 *    `originMode: 'center'` (Illustrator/Figma convention). */
function computeBounds(
  startX: number, startY: number,
  currentX: number, currentY: number,
  originMode: 'corner' | 'center',
): { x: number; y: number; width: number; height: number } {
  if (originMode === 'center') {
    const dx = Math.abs(currentX - startX);
    const dy = Math.abs(currentY - startY);
    return { x: startX - dx, y: startY - dy, width: dx * 2, height: dy * 2 };
  }
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
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
      // Drag-from-center: tool's Alt binding passes `originMode:'center'`.
      // Compute polygon center + radius from the drag vector so the shape
      // anchors on the click point. Without this, the dep falls back to
      // inscribing in the AABB (drag-from-corner default).
      if (params?.['originMode'] === 'center') {
        const dx = currentX - startX;
        const dy = currentY - startY;
        (extras as { center?: unknown }).center = { x: startX, y: startY };
        (extras as { radius?: unknown }).radius = Math.hypot(dx, dy);
      } else {
        if (params?.['center'] !== undefined) (extras as { center?: unknown }).center = params['center'];
        if (params?.['radius'] !== undefined) (extras as { radius?: unknown }).radius = params['radius'];
      }
      return extras;
    }
    case 'star': {
      const pts = Number(params?.['points'] ?? 5);
      const ir = Number(params?.['innerRadiusRatio'] ?? 0.5);
      const rotation = Number(params?.['rotation'] ?? 0);
      const extras: InsertExtras = { kind: 'star', points: pts, innerRadiusRatio: ir, rotation };
      if (params?.['originMode'] === 'center') {
        const dx = currentX - startX;
        const dy = currentY - startY;
        (extras as { center?: unknown }).center = { x: startX, y: startY };
        (extras as { outerRadius?: unknown }).outerRadius = Math.hypot(dx, dy);
      } else {
        if (params?.['center'] !== undefined) (extras as { center?: unknown }).center = params['center'];
        if (params?.['outerRadius'] !== undefined) (extras as { outerRadius?: unknown }).outerRadius = params['outerRadius'];
      }
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
  defaultBinding: { kind: 'drag' },
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
        altHeld: ctx.modifiers.alt,
        open: true,
      };

      return {
        onMove(moveCtx: InvocationCtx): void {
          scratch.currentX = moveCtx.world.x;
          scratch.currentY = moveCtx.world.y;
          // Track live Alt state for the corner ⇄ center toggle. Each
          // pointermove carries fresh modifier state from the dispatcher;
          // releasing / pressing Alt mid-drag flips the bounds mode on
          // the next move tick (true modifier-only events don't fire
          // without a cursor change).
          scratch.altHeld = moveCtx.modifiers.alt;
          // The dispatcher mutates its own per-gesture trail in place but
          // attaches the array reference to each InvocationCtx.drag — keep
          // the latest reference in case the dispatcher swaps it.
          if (moveCtx.drag?.points) scratch.points = moveCtx.drag.points;
        },
        overlay(): OngoingOverlay | null {
          if (!scratch.open) return null;
          // Resolve params on every overlay() so thunked params (polygon
          // sides ticking via ArrowUp mid-drag) reflect in the live preview.
          const resolved = resolveParams(scratch.opts?.params);
          const extras = buildExtras(
            resolved,
            scratch.startX,
            scratch.startY,
            scratch.currentX,
            scratch.currentY,
            scratch.points,
          );
          // Consumer-defined kinds aren't renderable by the kit overlay —
          // skip the preview rather than emit something half-faithful.
          if (!KIT_INSERT_KINDS.has(extras.kind)) return null;
          const mode = effectiveOriginMode(resolved?.['originMode'], scratch.altHeld);
          const bounds = computeBounds(
            scratch.startX, scratch.startY,
            scratch.currentX, scratch.currentY,
            mode,
          );
          // Re-derive extras with the *effective* mode so polygon/star
          // center+radius reflect the live Alt toggle, not the binding's
          // nominal originMode.
          const effectiveExtras = buildExtras(
            { ...(resolved ?? {}), originMode: mode },
            scratch.startX, scratch.startY,
            scratch.currentX, scratch.currentY,
            scratch.points,
          );
          return {
            kind: 'insertPreview',
            shape: effectiveExtras.kind as KitInsertShape,
            bounds,
            extras: effectiveExtras,
          };
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          scratch.open = false;
          if (reason === 'cancel') return;

          const { dep: d, opts: o, startX, startY, currentX, currentY } = scratch;
          const points = endCtx.drag?.points ?? scratch.points;

          // Resolve params at commit time so thunked params (polygon
          // `sides` adjusted mid-drag, etc.) see the latest tool state.
          const resolved = resolveParams(o?.params);
          const mode = effectiveOriginMode(resolved?.['originMode'], scratch.altHeld);
          const bounds = computeBounds(startX, startY, currentX, currentY, mode);
          const extras = buildExtras(
            { ...(resolved ?? {}), originMode: mode },
            startX, startY, currentX, currentY, points,
          );

          // Sub-threshold drag — no insert. Exception: pencil with a real
          // sample trail can still produce a meaningful path even when the
          // start ≈ end (e.g. a closed loop).
          if ((bounds.width === 0 || bounds.height === 0) && extras.kind !== 'pencil') return;

          d.commit(bounds, extras);
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
