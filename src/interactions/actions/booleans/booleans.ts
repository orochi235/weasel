/**
 * Pure action core for path boolean operations. Resolves the current
 * selection into z-ordered paths, runs the chosen op, and dispatches a
 * single batch of `Op`s (delete sources + insert results + set selection).
 *
 * The hook (`useBooleans`) wraps this with React glue; testing here is
 * trivial because the function takes a plain adapter.
 */
import {
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
} from 'features/paths/booleans';
import type { Path, PolygonPath } from 'features/paths/types';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';

/** The five v1 operations. */
export type BooleanOp = 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide';

/** Adapter the hook and the pure core both consume. */
export interface BooleansAdapter {
  getSelection(): NodeId[];
  getWorldPath(id: NodeId): Path | undefined;
  compareZ(a: NodeId, b: NodeId): number;
  createPathNode(path: Path): { id: string };
  applyBatch?(ops: Op[], label?: string): void;
  setSelection?(ids: NodeId[]): void;
  insertNode?(node: { id: string }): void;
  removeNode?(id: string): void;
}

/** Outcome reported back to callers (lets the hook surface no-op signals). */
export type BooleanOpResult =
  | { kind: 'applied'; resultIds: string[] }
  | { kind: 'noop'; reason: 'no-paths' | 'too-few-for-subtract' | 'empty-result' };

const LABEL: Record<BooleanOp, string> = {
  union: 'Union',
  intersect: 'Intersect',
  subtract: 'Subtract',
  exclude: 'Exclude',
  divide: 'Divide',
};

function isEmpty(p: PolygonPath): boolean {
  return p.commands.length === 0;
}

export function applyBooleanOp(
  adapter: BooleansAdapter,
  op: BooleanOp,
): BooleanOpResult {
  const sel = adapter.getSelection();
  // Resolve path nodes only, in back-to-front z-order (ascending).
  const entries = sel
    .map((id) => ({ id, path: adapter.getWorldPath(id) }))
    .filter((e): e is { id: NodeId; path: Path } => e.path != null)
    .sort((a, b) => adapter.compareZ(a.id, b.id));

  if (entries.length === 0) return { kind: 'noop', reason: 'no-paths' };
  if (op === 'subtract' && entries.length < 2) {
    return { kind: 'noop', reason: 'too-few-for-subtract' };
  }
  if (entries.length < 2) return { kind: 'noop', reason: 'no-paths' };

  const paths = entries.map((e) => e.path);
  let results: PolygonPath[];

  switch (op) {
    case 'union':     results = [pathUnion(...paths)]; break;
    case 'intersect': results = [pathIntersect(...paths)]; break;
    case 'exclude':   results = [pathExclude(...paths)]; break;
    case 'subtract': {
      // Illustrator "Minus Front": back − union(everything in front).
      const back = paths[0];
      const front = paths.length === 2 ? paths[1] : pathUnion(...paths.slice(1));
      results = [pathSubtract(back, front)];
      break;
    }
    case 'divide': {
      results = pathDivide(...paths);
      break;
    }
  }

  results = results.filter((p) => !isEmpty(p));
  if (results.length === 0) return { kind: 'noop', reason: 'empty-result' };

  const newNodes = results.map((p) => adapter.createPathNode(p));
  const ops: Op[] = [];
  for (const e of entries) ops.push(createDeleteOp({ node: { id: e.id } }));
  for (const n of newNodes) ops.push(createInsertOp({ node: n }));
  ops.push(createSetSelectionOp({
    from: sel,
    to: newNodes.map((n) => n.id as NodeId),
  }));
  dispatchApplyBatch(adapter, ops, LABEL[op]);

  return { kind: 'applied', resultIds: newNodes.map((n) => n.id) };
}
