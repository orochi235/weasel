/**
 * Ancestor-clip resolution for hit-testing.
 *
 * A container may clip its subtree, and the renderer honors that — so a child
 * outside the clip is not painted. Every pick path has to apply the same test
 * or it answers for a node the user cannot see.
 */

import { asNodeId, type NodeId, type Scene } from 'core/scene/types';
import { effectivePose } from 'core/scene/poseOverrides';
import { pathContainsPoint } from 'features/paths/pathHitTest';
import { findShapeSilhouette } from 'canvas/NodeShape';
import type { Path } from 'features/paths/types';

type AnyNode<TPose> = {
  id: NodeId;
  kind: string;
  parent?: NodeId | null;
  pose: TPose;
  clipFromPose?: (pose: TPose) => Path | null;
};

/** The clip a container imposes on its subtree, or null when it imposes none. */
function ownClipOf<TPose>(node: AnyNode<TPose>, pose: TPose): Path | null {
  if (node.kind !== 'container') return null;
  if (typeof node.clipFromPose === 'function') return node.clipFromPose(pose);
  return findShapeSilhouette(node as never, pose);
}

/**
 * True when `(wx, wy)` falls inside every clip imposed by `node`'s ancestors.
 * A node with no clipping ancestor always passes.
 *
 * Walks the parent chain rather than threading a chain down a recursive walk,
 * so a flat render-order scan can call it per candidate. Cheap because it only
 * runs on nodes that already survived their own bounds test.
 */
export function passesAncestorClips<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  node: { parent?: NodeId | null },
  wx: number,
  wy: number,
): boolean {
  let parentId = node.parent ?? null;
  const seen = new Set<string>();
  while (parentId !== null) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = scene.get(asNodeId(parentId)) as AnyNode<TPose> | undefined;
    if (!parent) break;
    const clip = ownClipOf(parent, effectivePose(scene.overrides, parent));
    if (clip !== null && !pathContainsPoint(clip, wx, wy)) return false;
    parentId = parent.parent ?? null;
  }
  return true;
}
