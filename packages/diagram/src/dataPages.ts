/** The pages a {@link DiagramData} is drawn on, and the connectors that cross between them. */
import { layoutPages, type Bounds, type PlacedPage } from '@weasel-js/core';
import type { DiagramData, DiagramSpec } from './dataTypes';
import { diagramGroupOf } from './group';
import { offPageSplits } from './offPage/split';
import { offPageTagSpecs, type OffPageTagLook } from './offPage/tag';
import type { OffPageSplit } from './offPage/trait';

/** `data`'s pages, placed in world space. */
export function diagramPages(data: DiagramData): PlacedPage[] {
  return layoutPages(data.pages ?? [], data.pageLayout);
}

/**
 * Which of `edges` cross between `pages`, lettered in their order, and the two
 * off-page tags of each that does. An edge with an end `boxOf` has no box for
 * is left whole.
 */
export function dataOffPage(
  edges: readonly { id: string; from: string; to: string }[],
  pages: readonly PlacedPage[],
  boxOf: (id: string) => Bounds | undefined,
  look: OffPageTagLook,
): { splits: ReadonlyMap<string, OffPageSplit>; tags: DiagramSpec[] } {
  const input = edges.flatMap((e) => {
    const from = boxOf(e.from);
    const to = boxOf(e.to);
    return from === undefined || to === undefined ? [] : [{ id: e.id, from, to }];
  });
  const splits = new Map<string, OffPageSplit>();
  const tags: DiagramSpec[] = [];
  for (const [id, split] of offPageSplits({ pages, edges: input })) {
    if (split === null) continue;
    splits.set(id, split);
    tags.push(...(offPageTagSpecs(id, split, pages, { ...look, layer: 'main' }) as DiagramSpec[]));
  }
  return { splits, tags };
}

/** {@link dataOffPage} for `diagramScene`: ends are boxed by where nodes and regions were
 *  placed, and by the group specs already made. Nothing when `data` has no pages. */
export function scenePageSplits(
  data: DiagramData,
  placedAt: ReadonlyMap<string, Bounds>,
  specs: readonly DiagramSpec[],
  edges: readonly { id: string; from: string; to: string }[],
  look: () => OffPageTagLook,
): { splits: ReadonlyMap<string, OffPageSplit>; tags: DiagramSpec[] } | null {
  const pages = diagramPages(data);
  if (pages.length === 0) return null;
  const groups = new Map(specs.filter((s) => diagramGroupOf(s) !== null).map((s) => [String(s.id), s.pose as Bounds]));
  return dataOffPage(edges, pages, (id) => placedAt.get(id) ?? groups.get(id), look());
}
