import type { NodeId, Scene } from 'core/scene/types';
import { isPaged } from 'core/pages/pageNodes';
import { pageForPoint } from 'core/pages/pagePlacement';
import { admitsChild } from '../admitsChild';
import type { CanDropIntoDep } from '../layoutDeps';

/** The node an insert lands in: the one the `insertInto` dep's `into` names when
 *  it exists and admits the insert; else, in a paged scene, the page for `at`
 *  (`pageForPoint`); else null, the top of the tree. */
export function insertParent(
  scene: Scene<unknown, string, unknown> | undefined,
  into: string | null | undefined,
  canDropInto?: CanDropIntoDep,
  at?: { x: number; y: number },
): NodeId | null {
  if (!scene) return null;
  if (into != null && scene.get(into as NodeId) !== undefined && admitsChild(scene, into as NodeId, [], canDropInto)) {
    return into as NodeId;
  }
  return at !== undefined && isPaged(scene) ? pageForPoint(scene, at) as NodeId | null : null;
}
