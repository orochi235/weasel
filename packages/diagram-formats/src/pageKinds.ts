/** Which kinds of page a scene would export as, read from its top-level content alone. */
import { placedPagesOf, type Scene } from '@weasel-js/core';
import type { PageKind } from './document';
import { pageRootsOf } from './pageRoots';

/**
 * The kinds of page `documentFromScene` would make of `scene`, without making
 * them: a page holding a plot's root is a plot page, one holding a sequence's
 * root a sequence page, any other a graph page, by the rule `pageRootsOf`
 * states. A root is on the page it is under, or on the pasteboard the one
 * holding its box. Cheap enough to ask on every menu render.
 *
 * With `opts.page`, the kind of the one page a one-page writer would write
 * (`writtenPage`): the page so named, else the first. A name the scene has no
 * page for throws a `RangeError`, as `writtenPage` does.
 */
export function scenePageKinds<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>, opts: { page?: string | undefined } = {},
): ReadonlySet<PageKind> {
  const placed = placedPagesOf(scene);
  // With no page list, `documentFromScene` makes one page around everything; any page stands in for it here.
  const pages = placed.length > 0 ? placed : [{ id: 'page-1', x: 0, y: 0, width: 0, height: 0, index: 0 }];
  const roots = pageRootsOf(scene, pages);
  const kindOf = (page: string): PageKind => roots.get(page)?.kind ?? 'graph';
  if ('page' in opts && placed.length > 0) {
    const written = opts.page === undefined ? placed[0]! : placed.find((p) => p.id === opts.page);
    if (written === undefined) throw new RangeError(`The scene has no page ${JSON.stringify(opts.page)} to write`);
    return new Set([kindOf(written.id)]);
  }
  return new Set(pages.map((p) => kindOf(p.id)));
}
