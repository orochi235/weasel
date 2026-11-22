import {
  AUTO_POSE_DESCRIPTOR, composesFrames, heldInFrame, poseDescriptorForNode, rebaseLocalPose, scenePoseAdapter,
  visualBoundsViaDescriptor, worldPoseOf, type AnyScene, type NodeId,
} from '@weasel-js/core';
import { multiply, transformPoint, type Affine, type Point } from '@weasel-js/geom';

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

/** Put back exactly what `id` and everything held in its frame store now, data and poses, with no undo step. */
export function restorer(scene: AnyScene, id: NodeId): () => void {
  const node = scene.get(id);
  if (!node) return () => {};
  const { data, pose } = node;
  const held = heldInFrame(scene, id).map((n) => ({ n, pose: scene.get(n)!.pose }));
  return () => scene.untracked(() => {
    if (!scene.get(id)) return;
    if (scene.get(id)!.data !== data) scene.update(id, { data });
    if (scene.get(id)!.pose !== pose) scene.setPose(id, pose);
    for (const h of held) if (scene.get(h.n) && scene.get(h.n)!.pose !== h.pose) scene.setPose(h.n, h.pose);
  });
}

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/**
 * How far from `center`, a shown world point, anything inside `id` draws: the farthest corner of
 * any descendant's drawn box, rotation included, and of every copy a group nested inside draws.
 * The copies `id` itself draws turn and reflect about `center`, so they reach no further.
 */
export function reachFrom(scene: AnyScene, id: NodeId, center: Point): number {
  let reach = 0;
  const walk = (at: NodeId, copies: readonly Affine[]): void => {
    for (const c of scene.childrenOf(at)) {
      const node = scene.get(c);
      if (!node) continue;
      const shown = worldPoseOf(scene, c, 'shown');
      const b = visualBoundsViaDescriptor(shown, poseDescriptorForNode(AUTO_POSE_DESCRIPTOR, node));
      const corners = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]] as const;
      for (const m of copies) {
        for (const [x, y] of corners) {
          const [px, py] = transformPoint(m, x, y);
          const r = Math.hypot(px - center.x, py - center.y);
          if (Number.isFinite(r)) reach = Math.max(reach, r);
        }
      }
      const own = node.kind === 'group' && node.copiesFromPose ? node.copiesFromPose(shown, node) ?? [] : [];
      walk(c, own.length === 0 ? copies : copies.flatMap((m) => [m, ...own.map((k) => multiply(m, k))]));
    }
  };
  walk(id, [IDENTITY]);
  return reach;
}
