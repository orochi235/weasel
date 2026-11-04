import type { NodeId, Scene } from 'core/scene/types';
import { isPaged, pageNodeOf, placedPagesOf } from 'core/pages/pageNodes';
import { pageForPoint } from 'core/pages/pagePlacement';
import { pageHolding } from 'core/pages/pages';
import { admitsChild } from '../admitsChild';
import type { CanDropIntoDep } from '../layoutDeps';

type AnyScene = Scene<unknown, string, unknown>;

/** The page (its `Page.id`) new content at `at` goes on: the page for `at` (`pageForPoint`) when it admits
 *  an insert (`admitsChild`), or failing that the nearest page to `at` that does. `null` when none does,
 *  when `pageForPoint` names none, and in a scene without pages. The one rule for insert and paste. */
export function takingPage(scene: AnyScene, at: { x: number; y: number }, canDropInto?: CanDropIntoDep): string | null {
  const first = isPaged(scene) ? pageForPoint(scene, at) : null;
  const point = { x: at.x, y: at.y, width: 0, height: 0 };
  let left = placedPagesOf(scene).filter((p) => p.id !== first);
  for (let page: string | null | undefined = first; page != null; ) {
    const node = pageNodeOf(scene, page);
    if (node !== null && admitsChild(scene, node, [], canDropInto)) return page;
    page = pageHolding(left, point)?.id;
    left = left.filter((p) => p.id !== page);
  }
  return null;
}

/** The node an insert lands in: the one the `insertInto` dep's `into` names when
 *  it exists and admits the insert; else, in a paged scene, the page for `at`
 *  ({@link takingPage}); else null, the top of the tree. */
export function insertParent(
  scene: AnyScene | undefined,
  into: string | null | undefined,
  canDropInto?: CanDropIntoDep,
  at?: { x: number; y: number },
): NodeId | null {
  if (!scene) return null;
  if (into != null && scene.get(into as NodeId) !== undefined && admitsChild(scene, into as NodeId, [], canDropInto)) {
    return into as NodeId;
  }
  const page = at === undefined ? null : takingPage(scene, at, canDropInto);
  return page === null ? null : pageNodeOf(scene, page);
}
