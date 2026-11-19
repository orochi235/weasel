import type { NodeId, Scene } from '@weasel-js/core';

/**
 * The node whose own box a whole-node transform of `ids` is measured from, when
 * that is not the box of the nodes it writes: a lone selected node whose pose
 * derives from the nodes it names, as a path effect's does. Its chrome sits on
 * its own box, which need not be the union of its sources. Null otherwise; a
 * container's derived pose is already its children's union.
 */
export function derivedBoxOwner(scene: Scene<unknown, string, unknown>, ids: readonly string[]): NodeId | null {
  if (ids.length !== 1) return null;
  const node = scene.get(ids[0] as NodeId);
  return node?.derivePose !== undefined && Array.isArray(node.dependsOn) && node.dependsOn.length > 0 ? node.id : null;
}
