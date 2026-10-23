import type { NodeId } from 'core/scene/types';
import type { CanDropIntoDep } from './layoutDeps';

/** The one rule for whether `parent` takes `ids` as children, by drop or by insert:
 *  `canDropInto` decides when present, else a group does and a mark does not. */
export function admitsChild(
  scene: { get(id: NodeId): { kind: string } | undefined },
  parent: NodeId,
  ids: readonly string[],
  canDropInto: CanDropIntoDep | undefined,
): boolean {
  if (canDropInto !== undefined) return canDropInto(parent as string, ids);
  return scene.get(parent)?.kind === 'group';
}
