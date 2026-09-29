import { boundsOfPath, type Path } from '@weasel-js/geom';
import { splitPathByPolyline, snipPathByPolyline } from '@weasel-js/geom/booleans';
import { pathToAnchors } from 'features/paths/anchors';
import type { Op } from 'core/ops/types';
import { createDeleteOp } from 'core/ops/delete';
import { createInsertOp } from 'core/ops/create';

/** The fields a slice reads from and writes to a node. */
export interface SliceableNode {
  id: string;
  pose: unknown;
  data: unknown;
}

/** One scene leaf a cut is tested against. */
export interface SliceLeaf<TNode extends SliceableNode = SliceableNode> {
  /** The whole node, which the delete op carries so undo restores it intact. */
  node: TNode;
  /** Its ordinal among its siblings: where the delete's undo puts it back,
   *  and where its pieces go in. */
  index: number;
  /** Its path with every pose above it baked in: the space the cut is in. */
  worldPath: Path;
}

interface SliceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Arguments to {@link computeSliceOps}. */
export interface ComputeSliceOpsArgs<TNode extends SliceableNode = SliceableNode> {
  leaves: readonly SliceLeaf<TNode>[];
  /** The cut, a polyline in world space. A last point equal to the first
   *  closes it into a loop. */
  cut: ReadonlyArray<{ x: number; y: number }>;
  /** Mints the id of each piece. */
  nextId: () => string;
  /** The selection before the cut. Given, the result carries the selection
   *  after it; omitted, `nextSelection` is `null`. */
  selection?: readonly string[];
  /** How a piece, cut in world space, is stored on its node. By default the
   *  pose is the source's with the piece's bounds and no rotation, and the
   *  path is the world piece itself, so any rotation is baked into it. A
   *  scene with rotated poses or parent frames maps the piece back into the
   *  node's own frame here. */
  placePiece?: (leaf: SliceLeaf<TNode>, piece: Path) => SlicePiece;
}

/** One piece as it is stored: the node's pose and its `data.path`. */
export interface SlicePiece {
  pose: unknown;
  path: Path;
}

/** Result of {@link computeSliceOps}. */
export interface ComputeSliceResult {
  /** A delete per cut leaf followed by an insert per piece, as one batch. */
  ops: Op[];
  /**
   * The selection after the cut: the cut sources dropped, the pieces of each
   * selected one added, everything else kept. `null` when no selection was
   * given or nothing was cut. It is not an op, so the caller sets it after
   * the batch commits; undo restores the one before either way.
   */
  nextSelection: string[] | null;
}

/**
 * Cut `leaves` along `cut` and return the ops that swap each crossed leaf for
 * its pieces.
 *
 * A path with an open subpath is snipped along its stroke
 * (`snipPathByPolyline`); a closed one is knifed into closed pieces
 * (`splitPathByPolyline`), which is also where a closed loop cuts out the
 * region it encloses. Each piece copies its source's node with the piece as
 * `data.path` and a fresh id. Leaves the cut misses produce nothing.
 */
export function computeSliceOps<TNode extends SliceableNode>(
  args: ComputeSliceOpsArgs<TNode>,
): ComputeSliceResult {
  const { cut, nextId, selection } = args;
  const placePiece = args.placePiece
    ?? ((leaf: SliceLeaf<TNode>, piece: Path): SlicePiece => ({ pose: piecePose(leaf.node.pose, boundsOfPath(piece)), path: piece }));
  const ops: Op[] = [];
  const selected = new Set(selection ?? []);
  const cutIds = new Set<string>();
  const inherited: string[] = [];

  // Highest slot first: swapping a leaf changes how many siblings sit below
  // the next one only when the next one is above it.
  const ordered = args.leaves.map((leaf, i) => ({ leaf, i })).sort((a, b) => b.leaf.index - a.leaf.index || a.i - b.i);

  for (const { leaf } of ordered) {
    const pieces = hasOpenSubpath(leaf.worldPath)
      ? snipPathByPolyline(leaf.worldPath, cut)
      : splitPathByPolyline(leaf.worldPath, cut);
    if (!pieces) continue;

    const sourceId = leaf.node.id;
    cutIds.add(sourceId);
    ops.push(createDeleteOp({ node: leaf.node, index: leaf.index, label: 'Slice' }));
    for (const piece of pieces) {
      const stored = placePiece(leaf, piece);
      const node = {
        ...leaf.node,
        id: nextId(),
        pose: stored.pose,
        data: { ...(leaf.node.data as object), path: stored.path },
      };
      ops.push(createInsertOp({ node, index: leaf.index, label: 'Slice' }));
      if (selected.has(sourceId)) inherited.push(node.id);
    }
  }

  const nextSelection = selection && cutIds.size > 0
    ? [...selection.filter((id) => !cutIds.has(id)), ...inherited]
    : null;
  return { ops, nextSelection };
}

function piecePose(source: unknown, b: SliceBounds): SliceBounds {
  const rest = source && typeof source === 'object' ? { ...(source as Record<string, unknown>) } : {};
  delete rest['rotation'];
  return { ...rest, x: b.x, y: b.y, width: b.width, height: b.height };
}

const hasOpenSubpath = (path: Path): boolean =>
  path.kind === 'polygon' && pathToAnchors(path).closed.some((closed) => !closed);
