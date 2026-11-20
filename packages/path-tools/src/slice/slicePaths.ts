/**
 * What a slice does with its cut: the commit `sliceAction` and the knife's
 * click-by-click actions hand every cut to, and the one they use by default.
 */
import type { ActionDeps, DepName, Point2 } from '@weasel-js/routing';
import {
  AUTO_POSE_DESCRIPTOR, commitOps, computeSliceOps, documentOf, drawnPose, indexedCandidates, leafPath,
  poseDescriptorForNode, scenePoseFrame, storePiece, storesEdits,
  type DrawnPose, type SceneNode as Node, type NodeId, type PoseDescriptor, type Scene, type SliceLeaf,
} from '@weasel-js/core';
import { boundsOfCoords, pathInWorld } from '@weasel-js/geom';

/**
 * Apply a cut: a polyline of at least two points (world coords), the drag's
 * two ends for a straight cut, its whole trail for a freehand one, the placed
 * points for a click-by-click one, whose last point equals its first when it
 * closes into a loop. `deps` are the canvas's, holding what `requires` names.
 */
export type SliceCommit = (cut: ReadonlyArray<Point2>, deps: ActionDeps) => void;

/** How a slice commits its cut: `createSliceAction`'s options, and `useSliceTool`'s. */
export interface SliceOptions {
  /** What a cut does. Default {@link slicePaths}. */
  commit?: SliceCommit;
  /** The deps `commit` reads. Default {@link SLICE_PATHS_REQUIRES} without a `commit`, none with one. */
  requires?: readonly DepName[];
}

/** The deps {@link slicePaths} reads. */
export const SLICE_PATHS_REQUIRES = ['scene', 'operands', 'applyOps', 'poseDescriptor'] as const satisfies readonly DepName[];

/** The commit and the deps it reads, with the defaults filled in. */
export function sliceCommitOf(opts: SliceOptions): { commit: SliceCommit; requires: readonly DepName[] } {
  return opts.commit
    ? { commit: opts.commit, requires: opts.requires ?? [] }
    : { commit: slicePaths, requires: opts.requires ?? SLICE_PATHS_REQUIRES };
}

/**
 * The default commit: cut every leaf the cut crosses and swap it for its
 * pieces in one undoable batch, through `applyOps` where the canvas has one.
 *
 * A leaf is cut when its `data.path` is a `Path` and `poseDescriptor` can read
 * its world pose as a box and a rotation; a leaf on a locked layer, one
 * whose geometry derives from other nodes, or one in a singular frame, where
 * no piece could be stored, is passed over. A piece keeps the
 * source's rotation in its pose when the descriptor can write one
 * (`withRotation`), and has the rotation baked into its path otherwise. The
 * pieces of a leaf among `operands` take its place there.
 */
export function slicePaths(cut: ReadonlyArray<Point2>, deps: ActionDeps): void {
  const scene = deps.scene;
  if (!scene) return;
  // A commit cuts what the document holds, not what an open gesture or edit is showing.
  const sc = documentOf(scene);
  const frame = scenePoseFrame(sc);
  const descriptor = deps.poseDescriptor ?? AUTO_POSE_DESCRIPTOR;
  const leaves: SliceLeaf<Node<unknown, string, unknown>>[] = [];
  const drawnAt = new Map<string, DrawnPose>();
  const nodes = (candidatesUnder(sc, descriptor, cut) ?? sc.renderOrderNodes()) as readonly Node<unknown, string, unknown>[];
  for (const node of nodes) {
    if (sc.isHidden(node.id)) continue;
    const path = leafPath(sc, node);
    if (!path || !storesEdits(sc, node)) continue;
    const drawn = drawnPose(poseDescriptorForNode(descriptor, node), frame.world(node.id));
    if (!drawn) continue;
    drawnAt.set(node.id, drawn);
    leaves.push({ node, index: siblingIndex(sc, node), worldPath: pathInWorld(path, drawn.box) });
  }

  const operands = deps.operands;
  const { ops, nextSelection } = computeSliceOps({
    leaves,
    cut,
    nextId: () => sc.mintId(),
    selection: operands?.get() ?? [],
    placePiece: (leaf, piece) => {
      const stored = storePiece(drawnAt.get(leaf.node.id)!, piece);
      return { pose: frame.local(leaf.node.id, stored.pose), path: stored.path };
    },
  });
  if (!commitOps(deps, ops, 'Slice')) return;
  if (nextSelection && operands) operands.set(nextSelection as NodeId[]);
}

/** The nodes whose boxes the cut's bounds reach, or null when the pick index cannot say. */
function candidatesUnder(
  scene: Scene<unknown, string, unknown>,
  descriptor: PoseDescriptor<unknown>,
  cut: ReadonlyArray<Point2>,
): readonly unknown[] | null {
  const b = boundsOfCoords(cut.flatMap((p) => [p.x, p.y]));
  if (b === null) return null;
  const broad = { box: { x: b[0], y: b[1], width: b[2] - b[0], height: b[3] - b[1] } };
  return indexedCandidates(scene, descriptor, () => broad);
}

function siblingIndex(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>): number {
  const siblings = node.parent == null ? scene.roots : scene.childrenOf(node.parent);
  return siblings.indexOf(node.id);
}
