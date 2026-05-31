/**
 * `lassoSelectAction` — ongoing Action descriptor for polygon lasso selection.
 *
 * ## Status: REAL (Phase 14b)
 *
 * Implements lasso-select via the full pointermove stream (accumulated in
 * `InvocationCtx.drag.points` by the Phase 14b dispatcher extension):
 *   - `start`: initializes vertex list from the drag-start world point.
 *   - `onMove`: appends the current world point (skipping duplicates closer
 *     than `minVertexSpacing = 2` world-px).
 *   - `onEnd('commit')`: performs hit-testing against the accumulated polygon.
 *     Uses `dep.hitTestLasso(polygon, 'centers')` when available, otherwise
 *     falls back to the polygon's AABB via `dep.hitTestArea(bounds)`.
 *     Extends selection with shift, replaces otherwise.
 *   - `onEnd('cancel')`: no-op.
 *
 * ## Dep
 *
 * Requires `lassoSelect` dep from DepSchema (Phase 14b addition):
 *   `{ hitTestLasso?(...), hitTestArea(...), getSelection(), setSelection(ids) }`
 *
 * ## What this does NOT wire (vs `useLassoSelect`)
 *
 * - Live overlay rendering — deferred to the overlay surface.
 * - `LassoSelectBehavior` pipeline — uses default replace/extend semantics.
 * - Transient vs. committed history modes — always transient (no undo entry),
 *   matching `useLassoSelect`'s `defaultTransient: true` convention.
 * - Debug sink recording.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, OngoingOverlay, Point2 } from '../invoker';
import type { LassoSelectDep } from '../depSchema';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Compute AABB of a polygon (for fallback hit-test when hitTestLasso is absent). */
function polygonAABB(
  pts: Point2[],
): { x: number; y: number; width: number; height: number } | null {
  if (pts.length === 0) return null;
  let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

const MIN_VERTEX_SPACING = 2; // world-px (matches useLassoSelect default)

interface LassoScratch {
  dep: LassoSelectDep;
  vertices: Point2[];
  shiftHeld: boolean;
  /** Current pointer position — paint the live "close-line" from the last
   *  vertex back to the start while the gesture is open. Tracked separately
   *  from `vertices` because we throttle vertex insertion. */
  currentX: number;
  currentY: number;
  /** Cleared by `onEnd` so post-commit `overlay()` returns null. */
  open: boolean;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `lassoSelect` Action.
 *
 * Requires dep-schema entry: `lassoSelect`.
 *
 * The invoker accumulates pointermove vertices via `InvocationCtx.drag.points`
 * (Phase 14b dispatcher extension) and commits a polygon hit-test at drag end.
 *
 * @see useLassoSelect — the React hook this descriptor mirrors for the default case.
 */
export const lassoSelectAction: Action & { requires: string[] } = {
  id: 'lassoSelect',
  label: 'Lasso Select',
  defaultBinding: { kind: 'drag', mods: { shift: 'optional' } },
  eligible: { capability: 'creates-selection' },
  requires: ['lassoSelect'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const dep = ctx.deps.lassoSelect as LassoSelectDep | undefined;
      if (!dep) return {};

      const scratch: LassoScratch = {
        dep,
        vertices: [{ x: ctx.world.x, y: ctx.world.y }],
        shiftHeld: ctx.modifiers.shift,
        currentX: ctx.world.x,
        currentY: ctx.world.y,
        open: true,
      };

      return {
        kind: 'lasso',
        onMove(moveCtx: InvocationCtx): void {
          const { x, y } = moveCtx.world;
          scratch.currentX = x;
          scratch.currentY = y;
          const last = scratch.vertices[scratch.vertices.length - 1];
          const dx = x - last.x;
          const dy = y - last.y;
          // Skip vertices closer than MIN_VERTEX_SPACING to avoid degenerate polygons.
          if (dx * dx + dy * dy >= MIN_VERTEX_SPACING * MIN_VERTEX_SPACING) {
            scratch.vertices.push({ x, y });
          }
        },
        overlay(): OngoingOverlay | null {
          if (!scratch.open) return null;
          return {
            kind: 'lasso',
            vertices: scratch.vertices,
            current: { x: scratch.currentX, y: scratch.currentY },
            shiftHeld: scratch.shiftHeld,
          };
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          scratch.open = false;
          if (reason === 'cancel') return;

          const { dep: d, vertices, shiftHeld } = scratch;

          // Need at least 3 vertices for a meaningful polygon; otherwise no-op.
          if (vertices.length < 3) {
            if (!shiftHeld) d.setSelection([]);
            return;
          }

          // Hit-test: prefer polygon test; fall back to AABB.
          let hits: string[];
          if (d.hitTestLasso) {
            hits = d.hitTestLasso(vertices, 'centers');
          } else {
            const aabb = polygonAABB(vertices);
            hits = aabb ? d.hitTestArea(aabb) : [];
          }

          if (shiftHeld) {
            // Extend: merge current + hits (deduplicated).
            const current = d.getSelection();
            const merged = [...current];
            for (const id of hits) {
              if (!merged.includes(id)) merged.push(id);
            }
            d.setSelection(merged);
          } else {
            d.setSelection(hits);
          }
        },
      };
    },
  },
  enabled: () => true,
};
