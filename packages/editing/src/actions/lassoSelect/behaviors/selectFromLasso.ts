import type { Op, NodeId } from '@weasel-js/core';
import type {
  LassoHitMode,
  LassoSelectAdapter,
} from '@weasel-js/core/engine';
import type { LassoSelectBehavior } from '@weasel-js/core/engine';
import { scratchKey, getScratch } from '@weasel-js/routing';
import { selectionFromHits } from '@weasel-js/core';
import * as ops from '@weasel-js/core/ops';
import type { Rect } from '@weasel-js/geom';

/** Typed scratch slot the lasso tool's gesture writes into for this behavior
 *  to consume. Shared identity: tools producing the polygon for a lasso
 *  selection write under this same key. */
export const LASSO_VERTICES = scratchKey<ReadonlyArray<{ x: number; y: number }>>('lassoSelect.vertices');

/** Whether a lasso through `vertices` reads as a click: fewer than three vertices, so the pointer never moved two
 *  vertex spacings. A lasso flat on one axis still crosses what lies along it, as a marquee does. */
export function isTinyLasso(vertices: ReadonlyArray<{ x: number; y: number }>): boolean {
  return vertices.length < 3;
}

/** The axis-aligned bounds of `pts`, or null for none: the rect a lasso falls back to when its host has no
 *  polygon test. */
export function polygonAabb(pts: ReadonlyArray<{ x: number; y: number }>): Rect | null {
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

/** Options for `selectFromLasso`. */
export interface SelectFromLassoOptions {
  /** Hit mode for `hitTestLasso`. Default 'intersect'. An adapter with only `hitTestArea` is asked for the
   *  polygon's bounds instead, whatever the mode. */
  mode?: LassoHitMode;
}

/** A lasso behavior (`useLassoTool({ behaviors })`): replace selection with
 *  polygon hits in its own `mode`, or extend the existing selection when shift
 *  is held at gesture start. Tiny / degenerate lassos behave like a click —
 *  clear (or preserve, with shift). Hits come from the gesture adapter's
 *  `hitTestLasso`, which under `lassoSelectAction` is the `lassoSelect` dep, or
 *  from its `hitTestArea` over the polygon's bounds when it has no polygon test.
 *  An adapter with neither leaves a real lasso to the next behavior. */
export function selectFromLasso(opts?: SelectFromLassoOptions): LassoSelectBehavior {
  const mode: LassoHitMode = opts?.mode ?? 'intersect';
  return {
    defaultTransient: true,
    onEnd(ctx) {
      const adapter = ctx.adapter as unknown as LassoSelectAdapter;
      if (!adapter.getSelection) return null;

      const vertices = getScratch(ctx.scratch, LASSO_VERTICES) ?? [];
      const startPose = ctx.origin.get('gesture');
      const shiftHeld = startPose ? (startPose as { shiftHeld?: boolean }).shiftHeld === true : false;
      const from = adapter.getSelection();

      // Tiny / degenerate lassos behave like a click: clear (or preserve on shift).
      if (isTinyLasso(vertices)) {
        const to = shiftHeld ? from : [];
        const op: Op = ops.setSelection({ from: from as NodeId[], to: to as NodeId[] });
        return [op];
      }

      let hits: string[];
      if (adapter.hitTestLasso) hits = adapter.hitTestLasso(vertices, mode);
      else if (adapter.hitTestArea) hits = adapter.hitTestArea(polygonAabb(vertices)!);
      else return undefined;
      const to = selectionFromHits(from, hits, shiftHeld);
      const op: Op = ops.setSelection({ from: from as NodeId[], to: to as NodeId[] });
      return [op];
    },
  };
}
