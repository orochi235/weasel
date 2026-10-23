import type { NodeId } from 'core/scene/types';
import { admitsChild } from '../admitsChild';
import type { CanDropIntoDep } from '../layoutDeps';

/** What finding an insert's parent reads of a scene. A `Scene` satisfies it. */
interface ParentReader {
  get(id: NodeId): { kind: string } | undefined;
}

/** The node an insert lands in: the one the `insertInto` dep's `into` names when
 *  it exists and admits the insert, or null, the top of the tree. */
export function insertParent(
  scene: ParentReader | undefined,
  into: string | null | undefined,
  canDropInto?: CanDropIntoDep,
): NodeId | null {
  if (into == null || !scene || scene.get(into as NodeId) === undefined) return null;
  return admitsChild(scene, into as NodeId, [], canDropInto) ? (into as NodeId) : null;
}
