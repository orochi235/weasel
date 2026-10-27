import {
  addPage, adjacentPage, fitViewToPage, movePage, nextPageId, pageInView, pagesOf, placedPagesOf, removePage,
  renamePage, resizePage, useLatest, type PlacedPage, type Scene, type View,
} from '@weasel-js/core';
import { useMemo, useState } from 'react';
import type { PageSize } from './paperLayer';

/** A document's pages, which one the view is on, and what can be done to them. */
export interface DocPages {
  placed: readonly PlacedPage[];
  /** The page the view shows most of, or `null` between pages. */
  current: string | null;
  /** The current page, else the last one that was while the view is between pages, else the first. */
  shown: PlacedPage | null;
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

type AnyScene = Scene<unknown, string, unknown>;

/** The page the view was last on, held while it sits between pages. */
function useShown(placed: readonly PlacedPage[], current: string | null): PlacedPage | null {
  const [last, setLast] = useState<string | null>(null);
  if (current !== null && current !== last) setLast(current);
  const id = current ?? last;
  return placed.find((p) => p.id === id) ?? placed[0] ?? null;
}

/**
 * A scene's pages, read from its `core:pages` value, with the view following them. Each edit is
 * one of core's page edits, so it moves what is on a page with it, in one undo entry. `padding`
 * is what fitting the view to a page leaves around it, in screen pixels.
 */
export function usePages<TData, TLayer extends string, TPose>(
  sceneIn: Scene<TData, TLayer, TPose>,
  view: View,
  dims: { width: number; height: number },
  setView: (view: View) => void,
  padding = 24,
): DocPages {
  const scene = sceneIn as unknown as AnyScene;
  // The doc value is replaced on every page edit, so its identity is the memo key.
  const doc = pagesOf(scene);
  const placed = useMemo(() => (doc ? placedPagesOf(scene) : []), [scene, doc]);
  const current = dims.width > 0 && dims.height > 0 ? pageInView(placed, view, dims)?.id ?? null : null;
  const shown = useShown(placed, current);
  const latest = useLatest({ view, dims, setView, current });
  return useMemo(() => {
    const show = (page: PlacedPage | null | undefined) => {
      const { view: v, dims: d, setView: set } = latest.current;
      if (page && d.width > 0 && d.height > 0) set(fitViewToPage(page, d, v, { padding }));
    };
    const goTo = (id: string) => show(placedPagesOf(scene).find((p) => p.id === id));
    return {
      placed,
      current,
      shown,
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
  }, [scene, placed, current, shown, latest, padding]);
}
