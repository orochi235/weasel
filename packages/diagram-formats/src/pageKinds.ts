/** Which kinds of page a scene would export as, read from its top-level nodes alone. */
import { pageHolding, placedPagesOf, type Scene } from '@weasel-js/core';
import { documentBoundsOf, sequenceRootOf } from '@weasel-js/diagram';
import { plotRootOf } from '@weasel-js/plot';
import type { PageKind } from './document';

/**
 * The kinds of page `documentFromScene` would make of `scene`, without making
 * them: a page holding a plot's root is a plot page, one holding a sequence's
 * root a sequence page, any other a graph page. Cheap enough to ask on every
 * menu render.
 */
export function scenePageKinds<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): ReadonlySet<PageKind> {
  const placed = placedPagesOf(scene);
  const claimed = new Map<string, PageKind>();
  const kinds = new Set<PageKind>();
  for (const id of scene.roots) {
    const node = scene.get(id)!;
    const kind: PageKind | null = plotRootOf(node) !== null ? 'plot' : sequenceRootOf(node) !== null ? 'sequence' : null;
    if (kind === null) continue;
    kinds.add(kind);
    const page = placed.length === 0 ? null : pageHolding(placed, documentBoundsOf(scene as never, node as never));
    if (page && !claimed.has(page.id)) claimed.set(page.id, kind);
  }
  if (placed.length === 0 ? kinds.size === 0 : placed.some((p) => !claimed.has(p.id))) kinds.add('graph');
  return kinds;
}
