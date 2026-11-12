import type { NodeId } from 'core/scene/types';
import { asFollower, followerLandings } from 'core/pages/pagePlacement';
import { pageOfNode } from 'core/pages/pageNodes';
import type { DropVerdict } from './dropVerdict';
import type { CanDropIntoDep } from './layoutDeps';

/** What deciding whether a parent takes children reads of a scene. A `Scene` satisfies it. */
interface ChildReader {
  get(id: NodeId): {
    kind: string; parent?: NodeId | null; page?: unknown; pageRun?: unknown; dependsOn?: unknown;
  } | undefined;
  isLocked?(id: NodeId): boolean;
  isHidden?(id: NodeId): boolean;
}

/** Where each of `ids` belongs by the follower rule (`followerLandings`) once they land in `parent`: each of
 *  them, and what is under it, is on `parent`'s page. `undefined` for an id that follows none. */
function followerPages(scene: ChildReader, parent: NodeId, ids: readonly string[]): (string | null | undefined)[] {
  const landing = pageOfNode(scene, parent);
  const followers = ids.flatMap((id) => asFollower(id, scene.get(id as NodeId)) ?? []);
  const pages = followerLandings(scene, new Map(ids.map((id) => [id, landing])), followers);
  return ids.map((id) => pages.get(id));
}

/** The one rule for whether `parent` takes `ids` as children, by drop, insert or paste. A locked parent
 *  takes none, nor does a hidden one, which would put what lands in it out of sight. The page run takes only nodes that follow others across pages, and no insert; a page takes a
 *  node following others only when everything it follows is on that page. Otherwise `canDropInto` decides
 *  when present, else a group does and a mark does not. */
export function childVerdict(
  scene: ChildReader,
  parent: NodeId,
  ids: readonly string[],
  canDropInto: CanDropIntoDep | undefined,
): DropVerdict {
  const target = scene.get(parent);
  if (scene.isLocked?.(parent) === true || scene.isHidden?.(parent) === true) return false;
  if (target?.pageRun !== undefined) {
    return ids.length > 0 && followerPages(scene, parent, ids).every((page) => page === null);
  }
  const own = target?.page === undefined ? null : pageOfNode(scene, parent);
  if (own !== null && followerPages(scene, parent, ids).some((page) => page !== undefined && page !== own)) {
    return false;
  }
  if (canDropInto !== undefined) return canDropInto(parent as string, ids);
  return target?.kind === 'group';
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
