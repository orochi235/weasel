import type { Bounds } from '@weasel-js/routing';
import type { Scene } from 'core/scene/types';
import { pageNodeOf, pageRunOf } from 'core/pages/pageNodes';
import { followerLandings, homeOfPage, keepOnPage, pasteboardOn, placedPage } from 'core/pages/pagePlacement';
import { takingPage } from 'interactions/actions/insert/parent';
import type { CanDropIntoDep } from 'interactions/actions/layoutDeps';
import { siteIn, type InsertSite } from './deps/insertSite';

/** Where one pasted root lands in a paged scene, and how much further it moves, with its subtree, to get there. */
export interface PageLanding {
  site: InsertSite;
  shift: { dx: number; dy: number };
}

/** A pasted root as {@link pasteOnPages} reads it: its id, its world box where the paste leaves it, and, for
 *  one that follows others, the id of the pasted root holding each node it follows (a node the paste does not
 *  hold stays as it is, wherever it is in the scene). */
export interface PastedRoot {
  id: string;
  bounds: Bounds;
  follows?: readonly string[];
}

const middle = (b: Bounds) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * Where a paste into a paged scene puts each of `roots`, in order. A root
 * that follows others goes on the page everything it follows lands on, else
 * in the page run (`followerLandings`), a follower of a pasted follower by
 * where that one lands. The rest each go on the page an insert at a point
 * would (`takingPage`, asking `canDropInto`): a lone one's is the paste's `dropPoint`, else its
 * middle, and each of several goes by its own middle. With the pasteboard
 * off, each moves so part of it is on its page. `null` in a scene without
 * pages.
 */
export function pasteOnPages(
  scene: Scene<unknown, string, unknown>,
  roots: readonly PastedRoot[],
  dropPoint: { x: number; y: number } | null | undefined,
  canDropInto?: CanDropIntoDep,
): PageLanding[] | null {
  const run = pageRunOf(scene);
  if (run === null) return null;
  const lone = roots.filter((r) => r.follows === undefined).length === 1;
  const pasteboard = pasteboardOn(scene);
  const pages = new Map(roots.filter((root) => root.follows === undefined).map((root) =>
    [root.id, takingPage(scene, lone && dropPoint ? dropPoint : middle(root.bounds), canDropInto)]));
  const followerPages = followerLandings(scene, pages, roots.flatMap((root) =>
    root.follows === undefined ? [] : [{ id: root.id, dependsOn: root.follows }]));
  return roots.map((root) => {
    if (root.follows !== undefined) {
      return { site: siteIn(scene, homeOfPage(scene, followerPages.get(root.id)!)), shift: { dx: 0, dy: 0 } };
    }
    const pageId = pages.get(root.id)!;
    const page = pageId === null || pasteboard ? null : placedPage(scene, pageId);
    return {
      site: siteIn(scene, pageId === null ? null : pageNodeOf(scene, pageId)),
      shift: page ? keepOnPage(page, root.bounds) : { dx: 0, dy: 0 },
    };
  });
}
