import type { NodeId, Scene } from 'core/scene/types';
import { poseDescriptorForNode, type PoseDescriptor } from './resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from './resize/autoPoseDescriptor';

/** The `poseDescriptor` dep's value, or the auto descriptor when unsourced. */
export function poseDescriptorOf(dep: unknown): PoseDescriptor<unknown> {
  return (dep as PoseDescriptor<unknown> | undefined) ?? AUTO_POSE_DESCRIPTOR;
}

/**
 * A reader of each node's own descriptor (`PoseDescriptor.forNode`), resolved
 * once per id. An action builds one where it captures its start poses and
 * reads and writes every pose through it, so a node measured as its own shape
 * is written as that shape too. An id that is not a scene node, such as a
 * multi-selection's stand-in target, reads through `descriptor` itself.
 */
export function nodeDescriptors(
  scene: Scene<unknown, string, unknown>,
  descriptor: PoseDescriptor<unknown>,
): (id: NodeId | string) => PoseDescriptor<unknown> {
  const resolved = new Map<string, PoseDescriptor<unknown>>();
  return (id) => {
    let d = resolved.get(id);
    if (d === undefined) {
      const node = scene.get(id as NodeId);
      d = node === undefined ? descriptor : poseDescriptorForNode(descriptor, node);
      resolved.set(id, d);
    }
    return d;
  };
}
