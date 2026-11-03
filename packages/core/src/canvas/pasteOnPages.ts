import type { Bounds } from '@weasel-js/routing';
import type { NodeId, Scene } from 'core/scene/types';
import { pageRunOf } from 'core/pages/pageNodes';
import { keepOnPage, pageForPoint, pasteboardOn, placedPage } from 'core/pages/pagePlacement';
import { siteIn, type InsertSite } from './deps/insertSite';

/** Where one pasted root lands in a paged scene, and how much further it moves, with its subtree, to get there. */
export interface PageLanding {
  site: InsertSite;
  shift: { dx: number; dy: number };
}

/** A pasted root as {@link pasteOnPages} reads it: whether it follows others, and its world box where the
 *  paste leaves it. */
export interface PastedRoot {
  follower: boolean;
  bounds: Bounds;
}

const middle = (b: Bounds) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * Where a paste into a paged scene puts each of `roots`, in order. A root
 * that follows others goes in the page run. The rest each go on the page for
 * a point (`pageForPoint`): a lone one's is the paste's `dropPoint`, else its
 * middle, and each of several goes by its own middle. With the pasteboard
 * off, each moves so part of it is on its page. `null` in a scene without
 * pages.
 */
export function pasteOnPages(
  scene: Scene<unknown, string, unknown>,
  roots: readonly PastedRoot[],
  dropPoint: { x: number; y: number } | null | undefined,
): PageLanding[] | null {
  const run = pageRunOf(scene);
  if (run === null) return null;
  const lone = roots.filter((r) => !r.follower).length === 1;
  const pasteboard = pasteboardOn(scene);
  return roots.map((root) => {
    if (root.follower) return { site: siteIn(scene, run), shift: { dx: 0, dy: 0 } };
    const pageId = pageForPoint(scene, lone && dropPoint ? dropPoint : middle(root.bounds));
    const page = pageId === null || pasteboard ? null : placedPage(scene, pageId);
    return {
      site: siteIn(scene, pageId as NodeId | null),
      shift: page ? keepOnPage(page, root.bounds) : { dx: 0, dy: 0 },
    };
  });
}
