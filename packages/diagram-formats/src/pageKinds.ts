/** Which kinds of page a scene would export as, read from its top-level nodes alone. */
import { pageHolding, placedPagesOf, type Scene } from '@weasel-js/core';
import { documentBoundsOf, sequenceRootOf } from '@weasel-js/diagram';
import type { PageKind } from './document';

/**
 * The kinds of page `documentFromScene` would make of `scene`, without making
 * them: a page holding a sequence's root is a sequence page, any other a graph
 * page. Cheap enough to ask on every menu render.
 */
export function scenePageKinds<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): ReadonlySet<PageKind> {
  const placed = placedPagesOf(scene);
  const sequencePages = new Set<string>();
  let sequences = 0;
  for (const id of scene.roots) {
    const node = scene.get(id)!;
    if (sequenceRootOf(node) === null) continue;
    sequences++;
    const page = placed.length === 0 ? null : pageHolding(placed, documentBoundsOf(scene as never, node as never));
    if (page) sequencePages.add(page.id);
  }
  const kinds = new Set<PageKind>();
  if (sequences > 0) kinds.add('sequence');
  if (placed.length === 0 ? sequences === 0 : placed.some((p) => !sequencePages.has(p.id))) kinds.add('graph');
  return kinds;
}
