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
  pathCrop,
} from 'features/paths/booleans';
import type { Path, PolygonPath } from '@weasel-js/geom';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { createMoveToIndexOp } from 'core/ops/reorder';
import { createSetSelectionOp } from 'core/ops/select';
import { locateChild } from 'core/ops/slot';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import { textToPath, TextOutlinesError, type TextNodeSource } from 'features/text/textToPath';

/** Boolean op identifiers — five Pathfinder primaries plus Crop. */
export type BooleanOp = 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide' | 'crop';

/**
 * z-position descriptor for a path node. `parentId` is the direct parent
 * (or `null` for a top-level node); `index` is the position within that
 * parent's child order — never a global render index.
 */
/** @internal */
export interface BooleanZOrder {
  parentId: string | null;
  index: number;
}

/** Adapter the hook and the pure core both consume. */
export interface BooleansAdapter {
  getSelection(): readonly NodeId[] | readonly string[];
  getWorldPath(id: NodeId): Path | undefined;
  /**
   * Optional: the text node behind `id`, for an id `getWorldPath` has no path
   * for. Its glyph outlines (`textToPath`) become the operand, so text can be
   * cut, united or intersected like any shape.
   */
  getTextSource?(id: NodeId): TextNodeSource | undefined;
  compareZ(a: NodeId, b: NodeId): number;
  /**
   * Mint a new node from a boolean-op result `Path`. `producedBy` names the
   * op that synthesized it — adapters that store provenance (e.g. for a
   * layer-panel icon) record it; others ignore the arg. `sourceId` is the
   * topmost source, whose slot the result takes: give the node that source's
   * parent, or the kit's reorder cannot find it there.
   */
  createPathNode(path: Path, producedBy: BooleanOp, sourceId: NodeId): { id: string };
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
   * Optional: the reorder contract. With `getChildren` (and `getParent`, or
   * every node reads as top-level) the kit reads each source's slot among its
   * siblings, and with `setChildOrder` as well it moves the result into the
   * topmost source's slot. Without them the result lands wherever
   * `insertNode` defaults to. `defaultCommitAdapter` supplies all three.
   */
  getParent?(id: string): string | null;
  getChildren?(parentId: string | null): readonly string[];
  setChildOrder?(parentId: string | null, ids: string[]): void;
  /**
   * Optional override for the slot the kit otherwise reads through
   * `getParent` / `getChildren`: `id`'s parent and its index in that
   * parent's child order.
   *
   * @deprecated Supply `getParent` and `getChildren` instead, and the kit
   * derives this.
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
  | { kind: 'noop'; reason: 'no-paths' | 'too-few-for-subtract' | 'empty-result' }
  /** A text operand had no outline geometry. Nothing was changed: an op that
   *  quietly dropped the operand would commit a different shape than asked. */
  | { kind: 'failed'; reason: 'text-outlines'; error: TextOutlinesError };

function operandPath(adapter: BooleansAdapter, id: NodeId): Path | undefined {
  const path = adapter.getWorldPath(id);
  if (path) return path;
  const text = adapter.getTextSource?.(id);
  if (!text) return undefined;
  // Blank text has no geometry, and is no more an operand than a group is.
  const glyphs = textToPath(text.data, text.pose);
  return glyphs.commands.length > 0 ? glyphs : undefined;
}

const LABEL: Record<BooleanOp, string> = {
  union: 'Union',
  intersect: 'Intersect',
  subtract: 'Subtract',
  exclude: 'Exclude',
  divide: 'Divide',
  crop: 'Crop',
};

function isEmpty(p: PolygonPath): boolean {
  return p.commands.length === 0;
}

/**
 * Run one Boolean operation over the selected paths and commit the result as a
 * single undoable batch.
 *
 * Operands are ordered back-to-front, which is what makes `subtract` mean
 * "everything in front removed from the backmost shape". Returns without
 * mutating anything when the selection holds no paths, or too few for the
 * requested operation.
 */
export function applyBooleanOp(
  adapter: BooleansAdapter,
  op: BooleanOp,
): BooleanOpResult {
  const sel = [...adapter.getSelection()] as NodeId[];
  const zOrder = (id: NodeId): BooleanZOrder | undefined =>
    adapter.getZOrder ? adapter.getZOrder(id) : locateChild(adapter, id) ?? undefined;
  // Resolve path nodes only, sorted ascending by `compareZ` so paths[0] is
  // the bottommost (back) member. `subtract` relies on this: it computes
  // `back − union(rest)`, which is Illustrator's "Minus Front." Keep this
  // convention in sync if compareZ semantics ever flip.
  let resolved: { id: NodeId; path: Path | undefined }[];
  try {
    resolved = sel.map((id) => ({ id, path: operandPath(adapter, id) }));
  } catch (err) {
    if (err instanceof TextOutlinesError) return { kind: 'failed', reason: 'text-outlines', error: err };
    throw err;
  }
  const entries = resolved
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
    case 'crop': {
      // Illustrator "Crop": clip every source-below-top to the topmost
      // path; topmost is consumed as the mask. `paths` is back-to-front
      // ascending, so the topmost source is `paths[paths.length-1]`.
      results = pathCrop(...paths);
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
  const topAnchor = zOrder(topmostId);
  let targetIndex = topAnchor?.index;
  if (topAnchor) {
    let shift = 0;
    for (let i = 0; i < entries.length - 1; i++) {
      const z = zOrder(entries[i].id);
      if (z && z.parentId === topAnchor.parentId && z.index < topAnchor.index) {
        shift++;
      }
    }
    targetIndex = topAnchor.index - shift;
  }

  const newNodes = results.map((p) => adapter.createPathNode(p, op, topmostId));
  const ops: Op[] = [];
  const captured: { node: { id: string }; index: number }[] = [];
  for (const e of entries) {
    // Capture the full node so the delete's `invert()` (an insert) restores
    // every field on undo. Fallback to a `{ id }` stub matches the legacy
    // behavior for adapters that haven't opted in yet. Index comes from
    // the same slot read used for anchoring; -1 when the adapter doesn't
    // expose order.
    const node = adapter.getNode?.(e.id) ?? { id: e.id };
    const index = zOrder(e.id)?.index ?? -1;
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
