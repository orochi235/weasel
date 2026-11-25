import type { Op, NodeId } from '@weasel-js/core';
import type {
  LassoHitMode,
  LassoSelectAdapter,
} from '@weasel-js/core/engine';
import type { LassoSelectBehavior } from '@weasel-js/core/engine';
import { scratchKey, getScratch } from '@weasel-js/routing';
import { selectionFromHits } from '@weasel-js/core';
import * as ops from '@weasel-js/core/ops';

/** Typed scratch slot the lasso tool's gesture writes into for this behavior
 *  to consume. Shared identity: tools producing the polygon for a lasso
 *  selection write under this same key. */
export const LASSO_VERTICES = scratchKey<ReadonlyArray<{ x: number; y: number }>>('lassoSelect.vertices');

/** Whether a lasso through `vertices` reads as a click: fewer than three vertices, so the pointer never moved two
 *  vertex spacings. A lasso flat on one axis still crosses what lies along it, as a marquee does. */
export function isTinyLasso(vertices: ReadonlyArray<{ x: number; y: number }>): boolean {
  return vertices.length < 3;
}

/** Options for `selectFromLasso`. */
export interface SelectFromLassoOptions {
  /** Hit mode for `hitTestLasso`. Default 'intersect'. */
  mode?: LassoHitMode;
}

/** A lasso behavior (`useLassoTool({ behaviors })`): replace selection with
 *  polygon hits in its own `mode`, or extend the existing selection when shift
 *  is held at gesture start. Tiny / degenerate lassos behave like a click —
 *  clear (or preserve, with shift). Hits come from the gesture adapter's
 *  `hitTestLasso`, which under `lassoSelectAction` is the `lassoSelect` dep. */
export function selectFromLasso(opts?: SelectFromLassoOptions): LassoSelectBehavior {
  const mode: LassoHitMode = opts?.mode ?? 'intersect';
  return {
    defaultTransient: true,
    onEnd(ctx) {
      const adapter = ctx.adapter as unknown as LassoSelectAdapter;
      if (!adapter.getSelection || !adapter.hitTestLasso) return null;

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

      const hits = adapter.hitTestLasso(vertices, mode);
      const to = selectionFromHits(from, hits, shiftHeld);
      const op: Op = ops.setSelection({ from: from as NodeId[], to: to as NodeId[] });
      return [op];
    },
  };
}
