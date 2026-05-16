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
import { createMoveToIndexOp } from 'core/ops/reorder';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';

/** The five v1 operations. */
export type BooleanOp = 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide';

/**
 * z-position descriptor for a path node. `parentId` is the direct parent
 * (or `null` for a top-level node); `index` is the position within that
 * parent's child order. Used by the optional `getZOrder` hook below to
 * reposition the result of a boolean op at the topmost source's slot.
 */
/** @internal */
export interface BooleanZOrder {
  parentId: string | null;
  index: number;
}

/** Adapter the hook and the pure core both consume. */
export interface BooleansAdapter {
  getSelection(): NodeId[];
  getWorldPath(id: NodeId): Path | undefined;
  compareZ(a: NodeId, b: NodeId): number;
  /**
   * Mint a new node from a boolean-op result `Path`. `producedBy` names the
   * op that synthesized it — adapters that store provenance (e.g. for a
   * layer-panel icon) record it; others ignore the arg.
   */
  createPathNode(path: Path, producedBy: BooleanOp): { id: string };
  /**
   * Optional: return the full object for an id, used by the delete ops so
   * their `invert` (an insert) can restore the complete object on undo.
   * If omitted, a `{ id }` stub is captured — undo will reinstate the id
   * but consumers reading other fields (path, fill, etc.) will see them as
   * undefined. Mirrors `DeleteAdapter.getNode`; should be provided whenever
   * undo over boolean ops is expected to be lossless.
   */
  getNode?(id: NodeId): { id: string } | undefined | null;
  /**
   * Optional: return the parent + child-index of `id` so the result of a
   * boolean op can be placed in the topmost source's z-slot. Adapters that
   * also expose `getChildren`/`setChildOrder` (the `ReorderAdapter`
   * contract) will have the kit emit a `createMoveToIndexOp` after the
   * inserts. Adapters that omit this method get v1 behavior — the result
   * lands wherever the adapter's plain `insertNode` defaults to.
   */
  getZOrder?(id: NodeId): BooleanZOrder | undefined;
  applyOps?(ops: Op[], label?: string): void;
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
  // Resolve path nodes only, sorted ascending by `compareZ` so paths[0] is
  // the bottommost (back) member. `subtract` relies on this: it computes
  // `back − union(rest)`, which is Illustrator's "Minus Front." Keep this
  // convention in sync if compareZ semantics ever flip.
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

  // Capture the topmost source's z-slot before we mutate the scene. The
  // topmost source is the last entry (entries are back-to-front ascending).
  // We adjust for selected members that sit below the topmost in the same
  // parent — their deletions collapse the parent's child list before the
  // reorder runs, so the visual slot the topmost occupied lives at a lower
  // index after the deletes. Members in a different parent don't affect
  // this parent's indexing.
  const topmostId = entries[entries.length - 1].id;
  const topAnchor = adapter.getZOrder?.(topmostId);
  let targetIndex = topAnchor?.index;
  if (topAnchor && adapter.getZOrder) {
    let shift = 0;
    for (let i = 0; i < entries.length - 1; i++) {
      const z = adapter.getZOrder(entries[i].id);
      if (z && z.parentId === topAnchor.parentId && z.index < topAnchor.index) {
        shift++;
      }
    }
    targetIndex = topAnchor.index - shift;
  }

  const newNodes = results.map((p) => adapter.createPathNode(p, op));
  const ops: Op[] = [];
  const captured: { node: { id: string }; index: number }[] = [];
  for (const e of entries) {
    // Capture the full node so the delete's `invert()` (an insert) restores
    // every field on undo. Fallback to a `{ id }` stub matches the legacy
    // behavior for adapters that haven't opted in yet. Index comes from
    // the same `getZOrder` already used for slot anchoring; -1 when the
    // adapter doesn't expose order.
    const node = adapter.getNode?.(e.id) ?? { id: e.id };
    const index = adapter.getZOrder?.(e.id)?.index ?? -1;
    captured.push({ node, index });
  }
  // Order by index DESC so reverse-then-invert (history's undo path)
  // re-inserts ASC — each splice lands on a correctly-sized array
  // instead of clamping high indices to a still-growing length.
  captured.sort((a, b) => b.index - a.index);
  for (const { node, index } of captured) ops.push(createDeleteOp({ node, index }));
  for (const n of newNodes) ops.push(createInsertOp({ node: n }));
  if (topAnchor && targetIndex !== undefined) {
    // After the deletes, the topmost source's index is no longer occupied;
    // moving the new nodes to the adjusted index drops them into that slot.
    // For divide (N outputs), they form a contiguous block in input order
    // starting at the target index.
    ops.push(createMoveToIndexOp({
      ids: newNodes.map((n) => n.id),
      parentId: topAnchor.parentId,
      index: targetIndex,
    }));
  }
  ops.push(createSetSelectionOp({
    from: sel,
    to: newNodes.map((n) => n.id as NodeId),
  }));
  dispatchApplyBatch(adapter, ops, LABEL[op]);

  return { kind: 'applied', resultIds: newNodes.map((n) => n.id) };
}
