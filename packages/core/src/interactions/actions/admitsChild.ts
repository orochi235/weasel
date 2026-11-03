import type { NodeId } from 'core/scene/types';
import { followedPage } from 'core/pages/pagePlacement';
import { pageOfNode } from 'core/pages/pageNodes';
import type { DropVerdict } from './dropVerdict';
import type { CanDropIntoDep } from './layoutDeps';

/** What deciding whether a parent takes children reads of a scene. A `Scene` satisfies it. */
interface ChildReader {
  get(id: NodeId): {
    kind: string; parent?: NodeId | null; page?: unknown; pageRun?: unknown; dependsOn?: unknown;
  } | undefined;
}

/** Where each of `ids` belongs by the follower rule (`followedPage`) once they land in `parent`: a node they
 *  follow that lands with them is on `parent`'s page. `undefined` for an id that follows none. */
function followerPages(scene: ChildReader, parent: NodeId, ids: readonly string[]): (string | null | undefined)[] {
  const moving = new Set(ids);
  const landing = pageOfNode(scene, parent);
  const pageOf = (dep: NodeId) => {
    for (let at: NodeId | null | undefined = dep; at != null; at = scene.get(at)?.parent) {
      if (moving.has(at)) return landing;
    }
    return pageOfNode(scene, dep);
  };
  return ids.map((id) => followedPage(scene, scene.get(id as NodeId), pageOf));
}

/** The one rule for whether `parent` takes `ids` as children, by drop or by insert. The page run takes only
 *  nodes that follow others across pages, and no insert; a page takes a node following others only when
 *  everything it follows is on that page. Otherwise `canDropInto` decides when present, else a group does
 *  and a mark does not. */
export function childVerdict(
  scene: ChildReader,
  parent: NodeId,
  ids: readonly string[],
  canDropInto: CanDropIntoDep | undefined,
): DropVerdict {
  const target = scene.get(parent);
  if (target?.pageRun !== undefined) {
    return ids.length > 0 && followerPages(scene, parent, ids).every((page) => page === null);
  }
  if (target?.page !== undefined && followerPages(scene, parent, ids).some((page) => page !== undefined && page !== parent)) {
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
