/**
 * Pure action core for path boolean operations. Resolves the current
 * selection into z-ordered paths, runs the chosen op, and dispatches a
 * single batch of `Op`s (delete sources + insert results + set selection).
 */
import type { Affine, Path } from '@weasel-js/geom';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { resolveFill } from '@weasel-js/paint';
import { TextOutlinesError, type TextNodeSource } from '@weasel-js/text';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import { resolveOperand, type BooleanOpOptions, type BooleanOperand } from './operands';
import { booleanPieces, type ResultPiece } from './pieces';
import { commitPieces } from './commit';

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
  getStrokeFrame?(id: NodeId): Affine | null | undefined;
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
   * draw it twice. Without `paint`, give it that source's paint. The kit never
   * reads a node's `data`: anything else the result should keep of its source,
   * a name say, is the adapter's to copy from `sourceId`.
   */
  createPathNode(path: Path, producedBy: BooleanOp, sourceId: NodeId, paint?: PathPaint): { id: string };
  /**
   * The full object for an id. The delete ops capture it, so their `invert`
   * (an insert) restores the complete object on undo.
   */
  getNode(id: NodeId): { id: string } | undefined | null;
  /**
   * The tree. The kit reads each source's slot among its siblings through
   * `getParent` and `getChildren`, and moves each result into the slot of
   * the topmost source in its own source's parent through `setChildOrder`.
   * `defaultCommitAdapter` supplies all three, and `getNode`.
   */
  getParent(id: string): string | null;
  getChildren(parentId: string | null): string[];
  setChildOrder(parentId: string | null, ids: string[]): void;
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

/** @internal A selected node and the operand it gives. */
export type BooleanEntry = { id: NodeId; operand: BooleanOperand };
type Entry = BooleanEntry;

/** @internal The operands behind `sel`, back to front, or the result that
 *  says why there are too few. Reads the adapter and changes nothing. */
export function resolveEntries(
  adapter: BooleansAdapter,
  sel: readonly NodeId[],
  op: BooleanOp,
  opts: BooleanOpOptions,
): Entry[] | Exclude<BooleanOpResult, { kind: 'applied' }> {
  // Sorted ascending by `compareZ` so the first entry is the bottommost
  // (back) member. `subtract` relies on this: it computes `back − union(rest)`.
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
  return entries;
}

/** The operands back to front and the pieces `op` makes of them, or the
 *  result that says why it makes none. Reads the adapter and changes nothing. */
function planBooleanOp(
  adapter: BooleansAdapter,
  sel: readonly NodeId[],
  op: BooleanOp,
  opts: BooleanOpOptions,
): { entries: Entry[]; pieces: ResultPiece[] } | Exclude<BooleanOpResult, { kind: 'applied' }> {
  const entries = resolveEntries(adapter, sel, op, opts);
  if ('kind' in entries) return entries;
  // Merge unites the operands that wear one fill; one whose paint is unknown is united with nothing.
  const fillKey = (i: number): unknown => {
    const { id, operand } = entries[i]!;
    const paint = operand.paint ?? adapter.getPaint?.(id);
    return paint ? JSON.stringify(resolveFill(paint.fill)) : i;
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
  const made = pieces.map((piece) => ({ path: piece.path, source: piece.source, producedBy: op }));
  return { kind: 'applied', resultIds: commitPieces(adapter, sel, entries, made, LABEL[op]) };
}
