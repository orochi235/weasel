import { AUTO_POSE_DESCRIPTOR, composeChildFrame, composesFrames, insertPreviewExtent, sceneViewPoseAdapter } from '@weasel-js/core/engine';
import { outputGridOf, quantizedNodePose } from '@weasel-js/core';
import type { Scene, InsertDep, InsertEnds, InsertExtras } from '@weasel-js/core/engine';
import type { Bounds, NodeId } from '@weasel-js/core';

/**
 * Where an insert's shape lands when the scene's quantize rule moves it off
 * the box the drag made, for the preview's `lands`: the node the `insert` dep
 * would make, as `stored` commits it. `undefined` when the rule changes
 * nothing, the scene has no grid, or the dep cannot say what it would make.
 */
export function insertLanding(
  scene: Scene<unknown, string, unknown>,
  dep: Pick<InsertDep, 'peek'>,
  bounds: Bounds,
  extras: InsertExtras,
  ends?: InsertEnds,
  /** The container the node lands in, whose frame its stored pose is in. */
  parent: NodeId | null = null,
): Bounds | undefined {
  if (!scene.quantize?.stored || !outputGridOf(scene)) return undefined;
  const node = dep.peek?.(bounds, extras, ends);
  if (!node) return undefined;
  const pose = quantizedNodePose(scene, node);
  if (pose === node.pose) return undefined;
  const world = worldOf(scene, parent);
  const from = AUTO_POSE_DESCRIPTOR.getBounds(world(node.pose));
  const to = AUTO_POSE_DESCRIPTOR.getBounds(world(pose));
  const made = insertPreviewExtent({ shape: extras.kind, bounds, extras }).bounds;
  return {
    x: made.x + to.x - from.x,
    y: made.y + to.y - from.y,
    width: made.width + to.width - from.width,
    height: made.height + to.height - from.height,
  };
}

/** A pose stored under `parent`, as the world sees it. */
function worldOf(scene: Scene<unknown, string, unknown>, parent: NodeId | null): (local: unknown) => unknown {
  const composition = scene.composition;
  if (parent === null || composition === undefined || !composesFrames(composition)) return (p) => p;
  const frame = composeChildFrame(sceneViewPoseAdapter(scene), parent, composition.compose);
  return (p) => composition.compose(frame, p);
}
