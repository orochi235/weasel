import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type {
  LassoHitMode,
  LassoSelectAdapter,
} from 'core/adapters/types';
import type { LassoSelectBehavior } from '../../../gestures/types';
import { scratchKey, getScratch } from '../../../scratchKey';

/** Typed scratch slot the lasso tool's gesture writes into for this behavior
 *  to consume. Shared identity: tools producing the polygon for a lasso
 *  selection write under this same key. */
export const LASSO_VERTICES = scratchKey<ReadonlyArray<{ x: number; y: number }>>('lassoSelect.vertices');

const MIN_AREA = 4;

/** Options for `selectFromLasso`. */
export interface SelectFromLassoOptions {
  /** Hit mode for `hitTestLasso`. Default 'intersect'. */
  mode?: LassoHitMode;
}

/** Default behavior for `useLassoSelect` / `useLassoTool`: replace selection
 *  with polygon hits, or extend the existing selection when shift is held at
 *  gesture start. Tiny / degenerate lassos behave like a click — clear (or
 *  preserve, with shift). */
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
      const tiny = vertices.length < 3 || polygonAabbArea(vertices) < MIN_AREA;
      if (tiny) {
        const to = shiftHeld ? from : [];
        const op: Op = createSetSelectionOp({ from: from as NodeId[], to: to as NodeId[] });
        return [op];
      }

      const hits = adapter.hitTestLasso(vertices, mode);
      const to = shiftHeld
        ? mergeUnique(from, hits)
        : hits;
      const op: Op = createSetSelectionOp({ from: from as NodeId[], to: to as NodeId[] });
      return [op];
    },
  };
}

function polygonAabbArea(vertices: ReadonlyArray<{ x: number; y: number }>): number {
  if (vertices.length === 0) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return (maxX - minX) * (maxY - minY);
}

function mergeUnique(a: ReadonlyArray<string>, b: ReadonlyArray<string>): string[] {
  const out = [...a];
  for (const id of b) if (!out.includes(id)) out.push(id);
  return out;
}
