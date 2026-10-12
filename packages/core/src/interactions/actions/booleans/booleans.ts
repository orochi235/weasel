/**
 * Pure action core for path boolean operations. Resolves the current
 * selection into z-ordered paths, runs the chosen op, and dispatches a
 * single batch of `Op`s (delete sources + insert results + set selection).
 *
 * The hook (`useBooleans`) wraps this with React glue; testing here is
 * trivial because the function takes a plain adapter.
 */
import type { Mat3, Path } from '@weasel-js/geom';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import { locateChild } from 'core/ops/slot';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import { TextOutlinesError, type TextNodeSource } from '@weasel-js/text';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import { resolveOperand, type BooleanOpOptions, type BooleanOperand } from './operands';
import { booleanPieces, type ResultPiece } from './pieces';
import { placementOps } from './placement';

/** Boolean op identifiers: the five Pathfinder primaries, and Crop, Trim, and Merge. */
export type BooleanOp = 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide' | 'crop' | 'trim' | 'merge';

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
  /**
   * Optional: the paint the path node behind `id` wears. An operation told to
   * count strokes (`BooleanOpOptions.strokes`) reads it to learn whether the
   * node is stroked and whether it is filled; without it every operand is its
   * path alone.
   */
  getPaint?(id: NodeId): PathPaint | undefined;
  /**
   * Optional: the frame the node behind `id` draws its stroke in, as the
   * matrix taking that frame to world (`poseFrameOf`); null or absent for a
   * node drawn straight. A counted world-width stroke is skewed and stretched
   * with it. Without it every stroke is outlined in world.
   */
  getStrokeFrame?(id: NodeId): Mat3 | null | undefined;
  compareZ(a: NodeId, b: NodeId): number;
  /**
   * Mint a new node from a boolean-op result `Path`. `producedBy` names the
   * op that synthesized it — adapters that store provenance (e.g. for a
   * layer-panel icon) record it; others ignore the arg. `sourceId` is the
   * source the result stands in for: the topmost, except that each piece of
   * a Divide, Crop, Trim, or Merge names the topmost source it was cut from. Give the
   * node that source's parent, or the kit's reorder cannot find it there.
   * `paint` is passed when that source's stroke went into the geometry, and
   * the node must wear it as given: wearing the source's stroke again would
   * draw it twice. Without `paint`, give it that source's paint.
   */
  createPathNode(path: Path, producedBy: BooleanOp, sourceId: NodeId, paint?: PathPaint): { id: string };
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
   * siblings, and with `setChildOrder` as well it moves each result into the
   * slot of the topmost source in its own source's parent. Without them the result lands wherever
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

const LABEL: Record<BooleanOp, string> = {
  union: 'Union',
  intersect: 'Intersect',
  subtract: 'Subtract',
  exclude: 'Exclude',
  divide: 'Divide',
  crop: 'Crop',
  trim: 'Trim',
  merge: 'Merge',
};

/** One path a Boolean operation would make. */
export interface BooleanPreviewPiece {
  path: Path;
  /** The source the piece stands in for; see `BooleansAdapter.createPathNode`. */
  sourceId: NodeId;
  /** Set when that source's stroke went into `path`: the paint the piece wears. */
  paint?: PathPaint;
}

/** What {@link previewBooleanOp} answers: the pieces, or why there are none. */
export type BooleanOpPreview =
  | { kind: 'pieces'; pieces: BooleanPreviewPiece[] }
  | Exclude<BooleanOpResult, { kind: 'applied' }>;

type Entry = { id: NodeId; operand: BooleanOperand };

/** The operands back to front and the pieces `op` makes of them, or the
 *  result that says why it makes none. Reads the adapter and changes nothing. */
function planBooleanOp(
  adapter: BooleansAdapter,
  sel: readonly NodeId[],
  op: BooleanOp,
  opts: BooleanOpOptions,
): { entries: Entry[]; pieces: ResultPiece[] } | Exclude<BooleanOpResult, { kind: 'applied' }> {
  // Resolve path nodes only, sorted ascending by `compareZ` so paths[0] is
  // the bottommost (back) member. `subtract` relies on this: it computes
  // `back − union(rest)`, which is Illustrator's "Minus Front." Keep this
  // convention in sync if compareZ semantics ever flip.
  let resolved: { id: NodeId; operand: BooleanOperand | undefined }[];
  try {
    resolved = sel.map((id) => ({ id, operand: resolveOperand(adapter, id, opts) }));
  } catch (err) {
    if (err instanceof TextOutlinesError) return { kind: 'failed', reason: 'text-outlines', error: err };
    throw err;
  }
  const entries = resolved
    .filter((e): e is Entry => e.operand != null)
    .sort((a, b) => adapter.compareZ(a.id, b.id));

  if (entries.length === 0) return { kind: 'noop', reason: 'no-paths' };
  if (op === 'subtract' && entries.length < 2) {
    return { kind: 'noop', reason: 'too-few-for-subtract' };
  }
  if (entries.length < 2) return { kind: 'noop', reason: 'no-paths' };

  // Merge unites the operands that wear one fill; one whose paint is unknown is united with nothing.
  const fillKey = (i: number): unknown => {
    const { id, operand } = entries[i]!;
    const paint = operand.paint ?? adapter.getPaint?.(id);
    return paint ? JSON.stringify(paint.fill ?? null) : i;
  };
  const pieces = booleanPieces(op, entries.map((e) => e.operand.path), fillKey);
  if (pieces.length === 0) return { kind: 'noop', reason: 'empty-result' };
  return { entries, pieces };
}

/**
 * What {@link applyBooleanOp} would make of the selection, without minting a
 * node or committing anything: for drawing an operation before it is applied.
 */
export function previewBooleanOp(
  adapter: BooleansAdapter,
  op: BooleanOp,
  opts: BooleanOpOptions = {},
): BooleanOpPreview {
  const plan = planBooleanOp(adapter, [...adapter.getSelection()] as NodeId[], op, opts);
  if ('kind' in plan) return plan;
  return {
    kind: 'pieces',
    pieces: plan.pieces.map((piece) => {
      const { id, operand } = plan.entries[piece.source]!;
      return operand.paint ? { path: piece.path, sourceId: id, paint: operand.paint } : { path: piece.path, sourceId: id };
    }),
  };
}

/**
 * Run one Boolean operation over the selected paths and commit the result as a
 * single undoable batch.
 *
 * Operands are ordered back-to-front, which is what makes `subtract` mean
 * "everything in front removed from the backmost shape". Returns without
 * mutating anything when the selection holds no paths, or too few for the
 * requested operation. `opts.strokes` says what a stroked operand gives.
 */
export function applyBooleanOp(
  adapter: BooleansAdapter,
  op: BooleanOp,
  opts: BooleanOpOptions = {},
): BooleanOpResult {
  const sel = [...adapter.getSelection()] as NodeId[];
  const plan = planBooleanOp(adapter, sel, op, opts);
  if ('kind' in plan) return plan;
  const { entries, pieces } = plan;
  const zOrder = (id: NodeId): BooleanZOrder | undefined =>
    adapter.getZOrder ? adapter.getZOrder(id) : locateChild(adapter, id) ?? undefined;

  // Every source's slot, read before the scene is mutated.
  const slots = entries.map((e) => zOrder(e.id));
  // A piece stands in for its own source: it is minted from that source, wears
  // the paint a stroke folded into that source left it, and takes its slot.
  const made = pieces.map((piece) => {
    const { id, operand } = entries[piece.source]!;
    return { node: adapter.createPathNode(piece.path, op, id, operand.paint), slot: slots[piece.source] };
  });
  const newNodes = made.map((m) => m.node);
  const ops: Op[] = [];
  // Capture the full node so the delete's `invert()` (an insert) restores
  // every field on undo; a `{ id }` stub for an adapter with no `getNode`.
  // The index is -1 when the adapter exposes no order.
  const captured = entries.map((e, i) => ({
    node: adapter.getNode?.(e.id) ?? { id: e.id },
    index: slots[i]?.index ?? -1,
  }));
  // Order by index DESC so reverse-then-invert (history's undo path)
  // re-inserts ASC — each splice lands on a correctly-sized array
  // instead of clamping high indices to a still-growing length.
  captured.sort((a, b) => b.index - a.index);
  for (const { node, index } of captured) ops.push(createDeleteOp({ node, index }));
  for (const n of newNodes) ops.push(createInsertOp({ node: n }));
  ops.push(...placementOps(made.map((m) => ({ id: m.node.id, slot: m.slot })), slots));
  ops.push(createSetSelectionOp({
    from: sel,
    to: newNodes.map((n) => n.id as NodeId),
  }));
  dispatchApplyBatch(adapter, ops, LABEL[op]);

  return { kind: 'applied', resultIds: newNodes.map((n) => n.id) };
}
