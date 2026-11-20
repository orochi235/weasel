/** Which pages a plot or a sequence makes their own: the one rule `documentFromScene` and `scenePageKinds` both read. */
import { contentRoots, type NodeId, type PlacedPage, type Scene } from '@weasel-js/core';
import { sequenceRootOf } from '@weasel-js/diagram';
import { plotRootOf } from '@weasel-js/plot';
import { exportPageOf } from './exportPage';

/** The root a page is drawn from, when it is not a graph page. */
export interface PageRoot {
  kind: 'plot' | 'sequence';
  id: NodeId;
}

/**
 * The plot or sequence root each of `pages` is drawn from. Only the scene's
 * outermost content counts (`contentRoots`): a plot or sequence root inside a
 * group or container leaves its page a graph page. A page holding both is a
 * plot page; of two of one kind, the first in order wins.
 */
export function pageRootsOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>, pages: readonly PlacedPage[],
): Map<string, PageRoot> {
  const out = new Map<string, PageRoot>();
  if (pages.length === 0) return out;
  for (const id of contentRoots(scene)) {
    const node = scene.get(id)!;
    const kind = plotRootOf(node) !== null ? 'plot' : sequenceRootOf(node) !== null ? 'sequence' : null;
    if (kind === null) continue;
    const page = exportPageOf(scene, pages, id);
    if (page === null) continue;
    const had = out.get(page);
    if (had === undefined || (had.kind === 'sequence' && kind === 'plot')) out.set(page, { kind, id });
  }
  return out;
}
