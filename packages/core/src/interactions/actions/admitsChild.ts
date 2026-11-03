import type { NodeId } from 'core/scene/types';
import { isFollower } from 'core/pages/pagePlacement';
import type { DropVerdict } from './dropVerdict';
import type { CanDropIntoDep } from './layoutDeps';

/** What deciding whether a parent takes children reads of a scene. A `Scene` satisfies it. */
interface ChildReader {
  get(id: NodeId): { kind: string; pageRun?: unknown; dependsOn?: unknown } | undefined;
}

/** The one rule for whether `parent` takes `ids` as children, by drop or by insert. The page run takes only
 *  nodes that follow others, and no insert. Otherwise `canDropInto` decides when present, else a group does
 *  and a mark does not. */
export function childVerdict(
  scene: ChildReader,
  parent: NodeId,
  ids: readonly string[],
  canDropInto: CanDropIntoDep | undefined,
): DropVerdict {
  if (scene.get(parent)?.pageRun !== undefined) {
    return ids.length > 0 && ids.every((id) => isFollower(scene.get(id as NodeId)));
  }
  if (canDropInto !== undefined) return canDropInto(parent as string, ids);
  return scene.get(parent)?.kind === 'group';
}

/** Whether {@link childVerdict} lets `ids` land in `parent`. */
export function admitsChild(
  scene: ChildReader,
  parent: NodeId,
  ids: readonly string[],
  canDropInto: CanDropIntoDep | undefined,
): boolean {
  return childVerdict(scene, parent, ids, canDropInto) === true;
}
