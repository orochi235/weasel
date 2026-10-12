import { poseDescriptorForNode, translatePoseViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { NodeId } from 'core/scene/types';
import type { PoseCascade } from '../animation/poseTarget';

/** The part of a scene a container's cascade reads. */
interface CascadeScene<TPose> {
  get(id: NodeId): { pose: TPose } | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
}

/** Every node under `id`, each after its parent. */
export function descendantsOf(scene: Pick<CascadeScene<unknown>, 'childrenOf'>, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const collect = (root: NodeId): void => {
    for (const child of scene.childrenOf(root)) {
      out.push(child);
      collect(child);
    }
  };
  collect(id);
  return out;
}

/**
 * How container `id`'s pose target carries its descendants where each holds a pose of its own
 * in the same space: `write` commits a pose and moves them, and while the container shows
 * somewhere else each is shown moved by as much.
 */
export function containerCascade<TPose>(
  scene: CascadeScene<TPose>,
  id: NodeId,
  d: PoseDescriptor<TPose>,
  write: (pose: TPose) => void,
): PoseCascade<TPose> {
  return {
    write,
    *beside(pose) {
      const node = scene.get(id);
      if (!node) return;
      const g = poseDescriptorForNode(d, node);
      const from = g.getBounds(node.pose);
      const to = g.getBounds(pose);
      for (const child of descendantsOf(scene, id)) {
        const n = scene.get(child);
        if (!n) continue;
        yield [child, translatePoseViaDescriptor(n.pose, to.x - from.x, to.y - from.y, poseDescriptorForNode(d, n))];
      }
    },
  };
}
