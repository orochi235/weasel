/** Which kinds of page a scene would export as, read from its top-level content alone. */
import { contentRoots, placedPagesOf, type Scene } from '@weasel-js/core';
import { sequenceRootOf } from '@weasel-js/diagram';
import { exportPageOf } from './exportPage';
import { plotRootOf } from '@weasel-js/plot';
import type { PageKind } from './document';

/**
 * The kinds of page `documentFromScene` would make of `scene`, without making
 * them: a page holding a plot's root is a plot page, one holding a sequence's
 * root a sequence page, any other a graph page. A root is on the page it is
 * under, or on the pasteboard the one holding its box. Cheap enough to ask on
 * every menu render.
 */
export function scenePageKinds<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): ReadonlySet<PageKind> {
  const placed = placedPagesOf(scene);
  const claimed = new Map<string, PageKind>();
  const kinds = new Set<PageKind>();
  for (const id of contentRoots(scene)) {
    const node = scene.get(id)!;
    const kind: PageKind | null = plotRootOf(node) !== null ? 'plot' : sequenceRootOf(node) !== null ? 'sequence' : null;
    if (kind === null) continue;
    kinds.add(kind);
    const page = exportPageOf(scene, placed, id);
    if (page !== null && !claimed.has(page)) claimed.set(page, kind);
  }
  if (placed.length === 0 ? kinds.size === 0 : placed.some((p) => !claimed.has(p.id))) kinds.add('graph');
  return kinds;
}
