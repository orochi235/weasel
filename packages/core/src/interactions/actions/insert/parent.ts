import type { NodeId, Scene } from 'core/scene/types';
import { isPaged, pageNodeOf, placedPagesOf } from 'core/pages/pageNodes';
import { pageForPoint } from 'core/pages/pagePlacement';
import { pageHolding } from 'core/pages/pages';
import { admitsChild } from '../admitsChild';
import type { CanDropIntoDep } from '../layoutDeps';

/** The node an insert lands in: the one the `insertInto` dep's `into` names when
 *  it exists and admits the insert; else, in a paged scene, the page for `at`
 *  (`pageForPoint`) when it admits the insert, or failing that the nearest page
 *  to `at` that does; else null, the top of the tree. */
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
  const first = at !== undefined && isPaged(scene) ? pageForPoint(scene, at) : null;
  if (first === null) return null;
  const admits = (page: string) => {
    const node = pageNodeOf(scene, page);
    return node !== null && admitsChild(scene, node, [], canDropInto) ? node : null;
  };
  const point = { x: at!.x, y: at!.y, width: 0, height: 0 };
  let left = placedPagesOf(scene).filter((p) => p.id !== first);
  for (let page: string | undefined = first; page !== undefined; ) {
    const node = admits(page);
    if (node !== null) return node;
    page = pageHolding(left, point)?.id;
    left = left.filter((p) => p.id !== page);
  }
  return null;
}
