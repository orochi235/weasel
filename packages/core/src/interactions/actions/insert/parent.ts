import type { NodeId } from 'core/scene/types';

/** What finding an insert's container reads of a scene. A `Scene` satisfies it. */
interface ContainerReader {
  get(id: NodeId): { kind: string } | undefined;
}

/** The container an insert lands in: the one the `insertInto` dep's `into`
 *  names, or null, the top of the tree, when it names no container. */
export function insertParent(scene: ContainerReader | undefined, into: string | null | undefined): NodeId | null {
  if (into == null || !scene) return null;
  return scene.get(into as NodeId)?.kind === 'container' ? (into as NodeId) : null;
}
