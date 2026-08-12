import {
  splitPathByLine,
  boundsOfPath,
  createDeleteOp,
  createInsertOp,
  type Path,
  type FillStyle,
  type Op,
  type LeafNode,
  type NodeId,
} from '@weasel-js/core';

/** The WeaselDraw-specific pose shape. Kept local so this module stays
 *  independent of App.tsx's private interface. */
interface WDPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** The WeaselDraw-specific data shape. */
interface WDData {
  path?: Path;
  text?: string;
  fill?: string | FillStyle;
  stroke?: string;
  strokeWidth?: number;
  label?: string;
}

/** A WeaselDraw leaf node — the full original node object.
 *  `createDeleteOp` receives this so its inverse `invert()` re-inserts the
 *  complete node (faithful undo). */
export type WDLeafNode = LeafNode<WDData, 'default', WDPose>;

/** Everything the commit function needs to know about one scene leaf. */
export interface SliceLeaf {
  /** The FULL original scene node — carried for faithful undo. */
  node: WDLeafNode;
  /** Global render-order position (DFS-preorder flat index from
   *  `scene.renderOrder()`). Forwarded to `createDeleteOp` so undo restores
   *  paint order — matches the convention used by `BooleansAdapterPublisher`. */
  index: number;
  /** Node geometry baked to world space (parent transforms applied). */
  worldPath: Path;
}

export interface ComputeSliceOpsArgs {
  leaves: readonly SliceLeaf[];
  a: { x: number; y: number };
  b: { x: number; y: number };
  nextId: () => string;
  /** Current selection ids. When provided AND at least one leaf is sliced,
   *  the op list ends with a `setSelection` op so pieces inherit their
   *  source's selected state: a selected source's pieces become selected, an
   *  unselected source's pieces stay unselected, and selected nodes the slice
   *  missed stay selected. Omit (e.g. pure-geometry callers / tests) to skip
   *  selection bookkeeping entirely. */
  selection?: readonly string[];
}

/** Result of {@link computeSliceOps}: the undoable geometry op list plus the
 *  post-op selection to apply imperatively. */
export interface ComputeSliceResult {
  /** Delete + insert ops, in commit order. Applied via `scene.applyBatch`. */
  ops: Op[];
  /**
   * Post-op selection (drop deleted sources, keep untouched survivors, add the
   * pieces of any source that was selected), or `null` when no `selection` was
   * supplied or nothing was sliced.
   *
   * Returned separately rather than baked into `ops` as a `setSelection` op:
   * in the real app `scene.applyBatch` routes the batch through the modality
   * journal, which applies each op via `op.apply(scene)` — and `Scene` has no
   * `setSelection`. The caller applies this to the live selection after the
   * geometry batch commits (see `SliceDepPublisher`).
   */
  nextSelection: string[] | null;
}

/**
 * Pure function: given crossed scene leaves and a finite slice segment a→b,
 * returns the undoable op list and the post-op selection.
 *
 * For each leaf whose `worldPath` is properly split by the segment:
 * - emits one `delete` op for the original node (with full node for undo)
 * - emits one `insert` op per resulting piece (preserving fill/stroke/etc.)
 *
 * Leaves the segment misses are silently skipped (empty result, `nextSelection`
 * stays the input selection / null).
 */
export function computeSliceOps(args: ComputeSliceOpsArgs): ComputeSliceResult {
  const { leaves, a, b, nextId, selection } = args;
  const ops: Op[] = [];

  const selSet = selection ? new Set(selection) : null;
  const deletedIds = new Set<string>();
  // Piece ids minted from a source that was selected — they inherit the
  // source's selected state.
  const inheritedPieceIds: string[] = [];
  let sliced = false;

  for (const leaf of leaves) {
    const pieces = splitPathByLine(leaf.worldPath, a, b);
    if (!pieces) continue;
    sliced = true;

    const sourceId = leaf.node.id as string;
    const sourceSelected = selSet?.has(sourceId) ?? false;
    deletedIds.add(sourceId);

    // Delete the original — pass the full node so invert() re-inserts it intact.
    ops.push(createDeleteOp({ node: leaf.node, index: leaf.index, label: 'Slice' }));

    for (const piece of pieces) {
      const bb = boundsOfPath(piece);
      const newNode: WDLeafNode = {
        ...leaf.node,
        id: nextId() as NodeId,
        pose: { x: bb.x, y: bb.y, width: bb.width, height: bb.height },
        data: { ...leaf.node.data, path: piece },
      };
      ops.push(createInsertOp({ node: newNode, index: leaf.index, label: 'Slice' }));
      if (sourceSelected) inheritedPieceIds.push(newNode.id as string);
    }
  }

  const nextSelection = (sliced && selection)
    ? [...selection.filter((id) => !deletedIds.has(id)), ...inheritedPieceIds]
    : null;

  return { ops, nextSelection };
}
