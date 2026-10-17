/**
 * Shape building: the selected paths cut into the faces their outlines bound,
 * then a pick of those faces united into one path, or deleted, as one undo step.
 */
import { pointInPath, type PolygonPath } from '@weasel-js/geom';
import { pathFacePieces, pathUnion } from '@weasel-js/geom/booleans';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import type { NodeId } from 'core/scene/types';
import type { BooleanOpResult, BooleansAdapter } from './booleans';
import { commitBooleanPieces, resolveBooleanOperands, type BooleanCommitPiece } from './custom';
import type { BooleanOpOptions } from './operands';

/** What a pick of faces does: unite them into one path, or delete them. */
export type ShapeBuilderMode = 'merge' | 'delete';

/** One face of the selection: a connected region no outline crosses. */
export interface ShapeBuilderFace {
  path: PolygonPath;
  /** The topmost source covering the face, which a path made of it stands in for. */
  sourceId: NodeId;
  /** Set when that source's stroke went into the face: the paint it wears. */
  paint?: PathPaint;
}

/** The faces of the selection, and the commit that rebuilds it from a pick of them. */
export interface ShapeBuilderPlan {
  kind: 'faces';
  /** Back to front by the sources they cover, exclusives first. */
  faces: readonly ShapeBuilderFace[];
  /** The index of the face holding the world point, or -1. */
  faceAt(x: number, y: number): number;
  /**
   * Replace the selection with its faces, the `picked` ones united into one
   * path standing in for the source of the first one picked (`'merge'`) or
   * left out (`'delete'`). Every other face becomes a path of its own. One
   * undo step, and what it made is selected. Commits nothing for an empty pick.
   */
  commit(picked: readonly number[], mode: ShapeBuilderMode): BooleanOpResult;
}

const LABEL = 'Shape Builder';

/**
 * The faces the selected paths cut each other into, or why there are none.
 * Reads the adapter and changes nothing; the plan's `commit` writes.
 */
export function planShapeBuilder(
  adapter: BooleansAdapter,
  opts: BooleanOpOptions = {},
): ShapeBuilderPlan | Exclude<BooleanOpResult, { kind: 'applied' }> {
  const operands = resolveBooleanOperands(adapter, opts);
  if ('kind' in operands) return operands;
  const { sources } = operands;
  const cut = pathFacePieces(...sources.map((s) => s.path))
    .filter((p) => p.path.commands.length > 0)
    .map((p) => ({ path: p.path, source: p.sources[p.sources.length - 1]! }));
  if (cut.length === 0) return { kind: 'noop', reason: 'empty-result' };
  const faces = cut.map(({ path, source }): ShapeBuilderFace => {
    const { id, paint } = sources[source]!;
    return paint ? { path, sourceId: id, paint } : { path, sourceId: id };
  });
  return {
    kind: 'faces',
    faces,
    faceAt: (x, y) => faces.findIndex((f) => pointInPath(f.path, x, y)),
    commit(picked, mode) {
      const chosen = [...new Set(picked)].filter((i) => i >= 0 && i < cut.length);
      if (chosen.length === 0) return { kind: 'noop', reason: 'empty-result' };
      const taken = new Set(chosen);
      const pieces: BooleanCommitPiece[] = cut.flatMap((c, i) => (taken.has(i) ? [] : [{ ...c, producedBy: 'divide' as const }]));
      if (mode === 'merge') {
        const first = cut[chosen[0]!]!;
        const path = chosen.length === 1 ? first.path : pathUnion(...chosen.map((i) => cut[i]!.path));
        pieces.push({ path, source: first.source, producedBy: 'union' });
      }
      // Stable, so each source's pieces keep their order and stack where it did.
      pieces.sort((a, b) => a.source - b.source);
      return commitBooleanPieces(adapter, operands, pieces, LABEL);
    },
  };
}

/**
 * The faces a run of world points passes through, each once, in the order
 * the run enters them. `step` is the world distance between the samples
 * taken along each segment; a face narrower than it can be stepped over.
 */
export function facesAlong(
  plan: Pick<ShapeBuilderPlan, 'faceAt'>,
  run: readonly { x: number; y: number }[],
  step: number,
): number[] {
  const out: number[] = [];
  const visit = (x: number, y: number): void => {
    const i = plan.faceAt(x, y);
    if (i >= 0 && !out.includes(i)) out.push(i);
  };
  if (run.length === 1) visit(run[0]!.x, run[0]!.y);
  for (let k = 1; k < run.length; k++) {
    const a = run[k - 1]!;
    const b = run[k]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let s = k === 1 ? 0 : 1; s <= n; s++) visit(a.x + ((b.x - a.x) * s) / n, a.y + ((b.y - a.y) * s) / n);
  }
  return out;
}
