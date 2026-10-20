import {
  addPage, adjacentPage, fitViewToPage, movePage, nextPageId, pageInView, pagesOf, placedPagesOf, removePage,
  renamePage, resizePage, useLatest, type PlacedPage, type View,
} from '@weasel-js/core';
import { useMemo } from 'react';
import type { ChartScene } from '../chartDocument';
import type { PageSize } from './pageSizes';

/** What fits the view to a page leaves around it, in screen pixels. */
export const PAGE_FIT_PADDING = 24;

/** A chart's pages, which one the view is on, and what can be done to them. */
export interface ChartPages {
  placed: readonly PlacedPage[];
  /** The page the view shows most of, or `null` between pages. */
  current: string | null;
  goTo(id: string): void;
  /** Go to the next page (`1`) or the one before (`-1`). */
  step(by: 1 | -1): void;
  /** Add a page after the current one, the same size, and go to it. */
  add(): void;
  /** Delete a page and what is on it. The last page cannot go. */
  remove(id: string): void;
  move(id: string, index: number): void;
  rename(id: string, name: string): void;
  resize(id: string, size: PageSize): void;
}

/** The chart's pages, read from the scene's `core:pages` value, with the view following them. */
export function useChartPages(
  scene: ChartScene,
  view: View,
  dims: { width: number; height: number },
  setView: (view: View) => void,
): ChartPages {
  // The doc value is replaced on every page edit, so its identity is the memo key.
  const doc = pagesOf(scene);
  const placed = useMemo(() => (doc ? placedPagesOf(scene) : []), [scene, doc]);
  const current = dims.width > 0 && dims.height > 0 ? pageInView(placed, view, dims)?.id ?? null : null;
  const latest = useLatest({ view, dims, setView, current });

  return useMemo(() => {
    const show = (page: PlacedPage | null | undefined) => {
      const { view: v, dims: d, setView: set } = latest.current;
      if (page && d.width > 0 && d.height > 0) set(fitViewToPage(page, d, v, { padding: PAGE_FIT_PADDING }));
    };
    const goTo = (id: string) => show(placedPagesOf(scene).find((p) => p.id === id));
    return {
      placed,
      current,
      goTo,
      step: (by) => show(adjacentPage(placedPagesOf(scene), latest.current.current, by)),
      add() {
        const pages = pagesOf(scene)?.pages ?? [];
        const at = pages.findIndex((p) => p.id === latest.current.current);
        const like = pages[at] ?? pages[pages.length - 1];
        const id = nextPageId(pages);
        addPage(scene, { id, width: like?.width ?? 816, height: like?.height ?? 1056 }, { index: at < 0 ? pages.length : at + 1 });
        goTo(id);
      },
      remove(id) {
        if ((pagesOf(scene)?.pages.length ?? 0) > 1) removePage(scene, id);
      },
      move: (id, index) => movePage(scene, id, index),
      rename: (id, name) => renamePage(scene, id, name),
      resize: (id, size) => resizePage(scene, id, size),
    };
  }, [scene, placed, current, latest]);
}
