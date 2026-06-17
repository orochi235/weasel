import {
  splitPathByLine,
  boundsOfPath,
  createDeleteOp,
  createInsertOp,
  type Path,
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
  fill?: string;
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
  /** Z-order index of this node within its sibling list. Forwarded to
   *  `createDeleteOp` so undo restores paint order. */
  index: number;
  /** Node geometry baked to world space (parent transforms applied). */
  worldPath: Path;
}

export interface ComputeSliceOpsArgs {
  leaves: readonly SliceLeaf[];
  a: { x: number; y: number };
  b: { x: number; y: number };
  nextId: () => string;
}

/**
 * Pure function: given crossed scene leaves and a finite slice segment a→b,
 * returns the undoable op list.
 *
 * For each leaf whose `worldPath` is properly split by the segment:
 * - emits one `delete` op for the original node (with full node for undo)
 * - emits one `insert` op per resulting piece (preserving fill/stroke/etc.)
 *
 * Leaves the segment misses are silently skipped (empty result).
 */
export function computeSliceOps(args: ComputeSliceOpsArgs): Op[] {
  const { leaves, a, b, nextId } = args;
  const ops: Op[] = [];

  for (const leaf of leaves) {
    const pieces = splitPathByLine(leaf.worldPath, a, b);
    if (!pieces) continue;

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
    }
  }

  return ops;
}
