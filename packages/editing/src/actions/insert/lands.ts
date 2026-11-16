import { AUTO_POSE_DESCRIPTOR, insertPreviewExtent } from '@weasel-js/core/engine';
import { outputGridOf, quantizedNodePose } from '@weasel-js/core';
import type { Scene, InsertDep, InsertEnds, InsertExtras } from '@weasel-js/core/engine';
import type { Bounds } from '@weasel-js/core';

/**
 * Where an insert's shape lands when the scene's quantize rule moves it off
 * the box the drag made, for the preview's `lands`: the node the `insert` dep
 * would make, as `stored` commits it. `undefined` when the rule changes
 * nothing, the scene has no grid, or the dep cannot say what it would make.
 */
export function insertLanding(
  scene: Pick<Scene<unknown, string, unknown>, 'doc' | 'quantize'>,
  dep: Pick<InsertDep, 'peek'>,
  bounds: Bounds,
  extras: InsertExtras,
  ends?: InsertEnds,
): Bounds | undefined {
  if (!scene.quantize?.stored || !outputGridOf(scene)) return undefined;
  const node = dep.peek?.(bounds, extras, ends);
  if (!node) return undefined;
  const pose = quantizedNodePose(scene, node);
  if (pose === node.pose) return undefined;
  // The stored pose is local to the insert's parent; under one that is not turned or scaled, its change is the world box's.
  const from = AUTO_POSE_DESCRIPTOR.getBounds(node.pose);
  const to = AUTO_POSE_DESCRIPTOR.getBounds(pose);
  const made = insertPreviewExtent({ shape: extras.kind, bounds, extras }).bounds;
  return {
    x: made.x + to.x - from.x,
    y: made.y + to.y - from.y,
    width: made.width + to.width - from.width,
    height: made.height + to.height - from.height,
  };
}
