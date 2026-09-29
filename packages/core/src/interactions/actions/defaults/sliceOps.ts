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

/** World-space bounds of one piece. */
export interface SliceBounds {
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
  /** The pose a piece is stored at. It is handed the piece's world pose —
   *  the source's pose with the piece's bounds and no rotation, since the
   *  path already carries it — which is also the default. A scene whose
   *  parents are frames rebases it here. */
  placePiece?: (leaf: SliceLeaf<TNode>, worldPose: SliceBounds) => unknown;
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
  const placePiece = args.placePiece ?? ((_leaf: SliceLeaf<TNode>, pose: SliceBounds) => pose);
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
      const b = boundsOfPath(piece);
      const node = {
        ...leaf.node,
        id: nextId(),
        pose: placePiece(leaf, piecePose(leaf.node.pose, b)),
        data: { ...(leaf.node.data as object), path: piece },
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
