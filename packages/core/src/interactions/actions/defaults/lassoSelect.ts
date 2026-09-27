/**
 * `lassoSelectAction` — ongoing Action descriptor for polygon lasso selection.
 *
 * ## Status: REAL
 *
 * Implements lasso-select via the full pointermove stream (accumulated in
 * `InvocationCtx.drag.points` by the dispatcher extension):
 *   - `start`: initializes vertex list from the drag-start world point.
 *   - `onMove`: appends the current world point, skipping one closer than
 *     the binding's `params.minVertexSpacing` (default 2 world-px) to the
 *     last vertex.
 *   - `onEnd('commit')`: performs hit-testing against the accumulated polygon.
 *     Uses `dep.hitTestLasso(polygon, mode)` when available — `mode` from the
 *     binding's `params.mode`, default `'intersect'` — otherwise falls back to
 *     the polygon's AABB via `dep.hitTestArea(bounds)`.
 *     Extends selection with shift, replaces otherwise.
 *   - `onEnd('cancel')`: no-op.
 *
 * ## Behaviors
 *
 * `opts.behaviors` (`LassoSelectBehavior[]`) run over a `GestureContext`
 * whose `origin.get('gesture')` is the start pose, whose scratch holds the
 * vertices under `LASSO_VERTICES`, and whose adapter answers selection and
 * hit-testing from the `lassoSelect` dep. `onEnd` is first-non-undefined-wins:
 * `Op[]` is applied in place of the default selection, `null` aborts, and
 * all-`undefined` falls through to it.
 *
 * ## Dep
 *
 * Requires `lassoSelect` dep from DepSchema:
 *   `{ hitTestLasso?(...), hitTestArea(...), getSelection(), setSelection(ids) }`
 *
 * ## What this does NOT wire
 *
 * - Committed history — always transient (no undo entry); a behavior's ops
 *   are applied the same way.
 * - Debug sink recording.
 */

import { resolveParams, setScratch, type Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle, OngoingOverlay, Point2 } from '@weasel-js/routing';
import type { LassoSelectDep, ViewApi } from '../depSchema';
import type { LassoHitMode, LassoSelectAdapter } from 'core/adapters/types';
import type { Op } from 'core/ops/types';
import { applyOpsTo } from 'core/applyOps';
import type { GestureContext, LassoSelectBehavior, LassoSelectPose } from '../../gestures/types';
import { LASSO_VERTICES } from '../lasso-select/behaviors/selectFromLasso';

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

/** The dep's polygon test, or its rect test over the polygon's AABB when it
 *  has none. What both the default commit and a behavior's adapter ask. */
function hitTestPolygon(
  dep: LassoSelectDep,
  vertices: ReadonlyArray<Point2>,
  mode: LassoHitMode,
  view: ViewApi | undefined,
): string[] {
  if (dep.hitTestLasso) return dep.hitTestLasso(vertices, mode, view);
  const aabb = polygonAABB(vertices as Point2[]);
  return aabb ? dep.hitTestArea(aabb, view) : [];
}

/** The adapter a behavior sees: selection and hit-testing from the dep,
 *  scoped to the view the lasso started in. */
function behaviorAdapter(dep: LassoSelectDep, view: ViewApi | undefined): LassoSelectAdapter {
  const adapter: LassoSelectAdapter = {
    getSelection: () => dep.getSelection(),
    setSelection: (ids) => dep.setSelection(ids),
    hitTestArea: (rect) => dep.hitTestArea(rect, view),
    hitTestLasso: (polygon, mode) => hitTestPolygon(dep, polygon, mode, view),
    applyOps: (ops: Op[]) => applyOpsTo(adapter, ops),
  };
  return adapter;
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

const DEFAULT_MIN_VERTEX_SPACING = 2; // world-px

interface LassoScratch {
  dep: LassoSelectDep;
  mode: LassoHitMode;
  minVertexSpacing: number;
  /** The view the lasso started in: what it does not paint is not taken. */
  view: ViewApi | undefined;
  vertices: Point2[];
  shiftHeld: boolean;
  /** Current pointer position — paint the live "close-line" from the last
   *  vertex back to the start while the gesture is open. Tracked separately
   *  from `vertices` because we throttle vertex insertion. */
  currentX: number;
  currentY: number;
  /** Cleared by `onEnd` so post-commit `overlay()` returns null. */
  open: boolean;
  behaviors: LassoSelectBehavior[];
  /** Built only when there are behaviors to hand it to. */
  gesture: GestureContext<LassoSelectPose> | null;
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
 * (dispatcher extension) and commits a polygon hit-test at drag end.
 *
 * @see useLassoSelect — the React hook this descriptor mirrors for the default case.
 */
export const lassoSelectAction: Action & { requires: string[] } = {
  id: 'lassoSelect',
  label: 'Lasso Select',
  defaultBinding: { kind: 'drag', mods: { shift: 'optional' } },
  eligible: { capability: 'creates-selection' },
  requires: ['lassoSelect', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts): OngoingHandle {
      const dep = ctx.deps.lassoSelect as LassoSelectDep | undefined;
      if (!dep) return {};

      const params = resolveParams(opts?.params) as
        { mode?: LassoHitMode; minVertexSpacing?: number } | undefined;
      const view = ctx.deps.view as ViewApi | undefined;
      const vertices: Point2[] = [{ x: ctx.world.x, y: ctx.world.y }];
      const behaviors = (opts?.behaviors ?? []) as LassoSelectBehavior[];
      let gesture: GestureContext<LassoSelectPose> | null = null;
      if (behaviors.length > 0) {
        const pose: LassoSelectPose = {
          worldX: ctx.world.x, worldY: ctx.world.y, shiftHeld: ctx.modifiers.shift,
        };
        gesture = {
          draggedIds: ['gesture'],
          origin: new Map([['gesture', pose]]),
          current: new Map([['gesture', { ...pose }]]),
          snap: null,
          modifiers: { ...ctx.modifiers },
          pointer: { worldX: ctx.world.x, worldY: ctx.world.y, clientX: 0, clientY: 0 },
          adapter: behaviorAdapter(dep, view) as unknown as GestureContext<LassoSelectPose>['adapter'],
          scratch: {},
        };
        // The live array, so a behavior reads every vertex added since.
        setScratch(gesture.scratch, LASSO_VERTICES, vertices);
        for (const b of behaviors) b.onStart?.(gesture);
      }
      const scratch: LassoScratch = {
        dep,
        mode: params?.mode ?? 'intersect',
        minVertexSpacing: params?.minVertexSpacing ?? DEFAULT_MIN_VERTEX_SPACING,
        view,
        vertices,
        shiftHeld: ctx.modifiers.shift,
        currentX: ctx.world.x,
        currentY: ctx.world.y,
        open: true,
        behaviors,
        gesture,
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
          const min = scratch.minVertexSpacing;
          if (dx * dx + dy * dy >= min * min) {
            scratch.vertices.push({ x, y });
          }
          const g = scratch.gesture;
          if (g) {
            g.modifiers = { ...moveCtx.modifiers };
            g.pointer = { worldX: x, worldY: y, clientX: 0, clientY: 0 };
            g.current.set('gesture', { worldX: x, worldY: y, shiftHeld: scratch.shiftHeld });
            const proposed = { vertices: scratch.vertices, shiftHeld: scratch.shiftHeld };
            for (const b of scratch.behaviors) b.onMove?.(g, proposed);
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

          const { dep: d, mode, view, vertices, shiftHeld, gesture: g } = scratch;

          if (g) {
            for (const b of scratch.behaviors) {
              const r = b.onEnd?.(g);
              if (r === undefined) continue;
              if (r !== null) (g.adapter as unknown as LassoSelectAdapter).applyOps!(r);
              return;
            }
          }

          // Need at least 3 vertices for a meaningful polygon; otherwise no-op.
          if (vertices.length < 3) {
            if (!shiftHeld) d.setSelection([]);
            return;
          }

          const hits = hitTestPolygon(d, vertices, mode, view);

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
