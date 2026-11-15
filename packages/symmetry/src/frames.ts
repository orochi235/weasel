import {
  AUTO_POSE_DESCRIPTOR, composesFrames, heldInFrame, poseDescriptorForNode, rebaseLocalPose, scenePoseAdapter,
  visualBoundsViaDescriptor, worldPoseOf, type AnyScene, type NodeId,
} from '@weasel-js/core';
import type { Point } from '@weasel-js/geom';

/** `world` as a pose stored under `parent`, so the node draws there, or `null`
 *  when `parent`'s frame is singular and no stored pose does. */
export function localPoseUnder(scene: AnyScene, world: unknown, parent: NodeId | null): unknown {
  const { compose, decompose } = scene.composition;
  return rebaseLocalPose(scenePoseAdapter(scene), world, parent, compose, decompose);
}

/**
 * Run `change`, which moves container `id`'s pose or moves its children to
 * another parent, and leave everything that was inside it where it drew
 * before. Nothing to do in a scene of absolute poses.
 */
export function keepContentsPut(scene: AnyScene, id: NodeId, change: () => void): void {
  if (!composesFrames(scene.composition)) {
    change();
    return;
  }
  const held = heldInFrame(scene, id).map((n) => ({ n, world: worldPoseOf(scene, n, 'document') }));
  change();
  for (const { n, world } of held) {
    const local = localPoseUnder(scene, world, scene.get(n)!.parent);
    // A node in a singular frame drew flat before the change and does after it; nothing stored keeps it.
    if (local !== null) scene.setPose(n, local);
  }
}

/**
 * How far from `center` anything inside `id` draws: the farthest corner of
 * any descendant's drawn box, rotation included. A symmetry's copies turn and
 * reflect about `center`, so they reach no further.
 */
export function reachFrom(scene: AnyScene, id: NodeId, center: Point): number {
  let reach = 0;
  const walk = (at: NodeId): void => {
    for (const c of scene.childrenOf(at)) {
      const node = scene.get(c);
      if (!node) continue;
      const b = visualBoundsViaDescriptor(worldPoseOf(scene, c, 'document'), poseDescriptorForNode(AUTO_POSE_DESCRIPTOR, node));
      const dx = Math.max(Math.abs(b.x - center.x), Math.abs(b.x + b.width - center.x));
      const dy = Math.max(Math.abs(b.y - center.y), Math.abs(b.y + b.height - center.y));
      const r = Math.hypot(dx, dy);
      if (Number.isFinite(r)) reach = Math.max(reach, r);
      walk(c);
    }
  };
  walk(id);
  return reach;
}
