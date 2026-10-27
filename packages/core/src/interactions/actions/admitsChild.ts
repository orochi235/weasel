import type { NodeId } from 'core/scene/types';
import type { DropVerdict } from './dropVerdict';
import type { CanDropIntoDep } from './layoutDeps';

/** The one rule for whether `parent` takes `ids` as children, by drop or by insert:
 *  `canDropInto` decides when present, else a group does and a mark does not. */
export function childVerdict(
  scene: { get(id: NodeId): { kind: string } | undefined },
  parent: NodeId,
  ids: readonly string[],
  canDropInto: CanDropIntoDep | undefined,
): DropVerdict {
  if (canDropInto !== undefined) return canDropInto(parent as string, ids);
  return scene.get(parent)?.kind === 'group';
}

/** Whether {@link childVerdict} lets `ids` land in `parent`. */
export function admitsChild(
  scene: { get(id: NodeId): { kind: string } | undefined },
  parent: NodeId,
  ids: readonly string[],
  canDropInto: CanDropIntoDep | undefined,
): boolean {
  return childVerdict(scene, parent, ids, canDropInto) === true;
}
