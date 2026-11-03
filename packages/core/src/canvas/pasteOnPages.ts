import type { Bounds } from '@weasel-js/routing';
import { unionRects } from '@weasel-js/geom';
import type { NodeId, Scene } from 'core/scene/types';
import { pageRunOf } from 'core/pages/pageNodes';
import { keepOnPage, pageForPoint, pasteboardOn, placedPage } from 'core/pages/pagePlacement';
import { siteIn, type InsertSite } from './deps/insertSite';

/** Where a paste's roots land in a paged scene, and how much further the whole paste moves to get there. */
export interface PageLanding {
  /** For the roots that follow others: the page run. */
  follower: InsertSite;
  /** For the rest: a page, or the top of the tree. */
  other: InsertSite;
  shift: { dx: number; dy: number };
}

/**
 * Where a paste into a paged scene puts its roots, from `bounds`, the world
 * boxes of the roots that follow nothing, where the paste leaves them. Those
 * go on the page for the paste's anchor (`pageForPoint`): `dropPoint`, else
 * the middle of the boxes. With the pasteboard off the paste moves by `shift`
 * so part of it is on that page. The roots that follow others go in the page
 * run. `null` in a scene without pages.
 */
export function pasteOnPages(
  scene: Scene<unknown, string, unknown>,
  bounds: readonly Bounds[],
  dropPoint: { x: number; y: number } | null | undefined,
): PageLanding | null {
  const run = pageRunOf(scene);
  if (run === null) return null;
  const cluster = unionRects(bounds);
  const anchor = dropPoint ?? (cluster && { x: cluster.x + cluster.width / 2, y: cluster.y + cluster.height / 2 });
  const pageId = anchor ? pageForPoint(scene, anchor) : null;
  const page = pageId === null || pasteboardOn(scene) ? null : placedPage(scene, pageId);
  return {
    follower: siteIn(scene, run),
    other: siteIn(scene, pageId as NodeId | null),
    shift: page && cluster ? keepOnPage(page, cluster) : { dx: 0, dy: 0 },
  };
}
