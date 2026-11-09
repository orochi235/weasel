import {
  HOME_VIEW, addPage, adjacentPage, fitViewToPage, movePage, nextPageId, pageInView, pagesOf, placedPagesOf, removePage,
  renamePage, resizePage, useLatest, type PlacedPage, type Scene, type View,
} from '@weasel-js/core';
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { PageSize } from './paperLayer';
import { sendView, usePageSettle, type Paging, type ViewSink } from './usePageSettle';

/** The page size `add` gives the first page of a scene without any: US Letter at 96 per inch. */
const FIRST_PAGE = { width: 816, height: 1056 } as const;

/** What {@link usePages} takes beyond the view. */
export interface UsePagesOptions {
  /** How the view moves through the pages; `'single'` settles it onto one page (`usePageSettle`). */
  paging?: Paging;
}

/** Where {@link DocPages.add} puts a new page: its index in the page list, and the size of the page it
 *  follows, absent when the scene has no page to copy. */
export interface PagePlace {
  index: number;
  size?: PageSize;
}

/** What {@link DocPages.add} takes. */
export interface AddPageOptions {
  /** Adds the page at `place` and answers its id, in place of a blank page. */
  make?(place: PagePlace): string;
}

/** A document's pages, which one the view is on, and what can be done to them. */
export interface DocPages {
  placed: readonly PlacedPage[];
  /** The page the view shows most of, or `null` between pages. */
  current: string | null;
  /** The current page, else the last one that was while the view is between pages, else the first. */
  shown: PlacedPage | null;
  goTo(id: string): void;
  /** Go to the page after the one the view is on or was last on (`1`), or the one before it (`-1`). A view never
   *  yet on a page is before the first: either way goes to the first page. */
  step(by: 1 | -1): void;
  /** Add a page after the one the view is on or was last on, the same size, and go to it; after the last page
   *  while the view has never been on one. A scene without pages gets its first, and with it the page run
   *  that makes it paged. */
  add(options?: AddPageOptions): void;
  /** Delete a page and what is on it. The last page cannot go. */
  remove(id: string): void;
  move(id: string, index: number): void;
  rename(id: string, name: string): void;
  resize(id: string, size: PageSize): void;
}

type AnyScene = Scene<unknown, string, unknown>;

/** A reader of `scene`'s placed pages that answers the array it last read, by identity, until a scene
 *  edit changes how they read. */
function placedReader(scene: AnyScene): () => readonly PlacedPage[] {
  let version = scene.getVersion();
  let placed: readonly PlacedPage[] = placedPagesOf(scene);
  return () => {
    const now = scene.getVersion();
    if (now !== version) {
      version = now;
      const next = placedPagesOf(scene);
      if (!samePlaced(placed, next)) placed = next;
    }
    return placed;
  };
}

/** The scene's placed pages, re-rendering the host only when they change. */
function usePlaced(scene: AnyScene): readonly PlacedPage[] {
  const read = useMemo(() => placedReader(scene), [scene]);
  return useSyncExternalStore(scene.subscribe, read, read);
}

function samePlaced(a: readonly PlacedPage[], b: readonly PlacedPage[]): boolean {
  return a.length === b.length && a.every((p, i) => {
    const q = b[i]!;
    return p.id === q.id && p.x === q.x && p.y === q.y && p.width === q.width && p.height === q.height
      && p.index === q.index && p.name === q.name && p.meta === q.meta;
  });
}

/** The page the view is on or was last on, held while it sits between pages: `null` until the view has been on
 *  one. `shown` falls back from it to the first page. */
function useShown(placed: readonly PlacedPage[], current: string | null): { held: PlacedPage | null; shown: PlacedPage | null } {
  const [last, setLast] = useState<string | null>(null);
  if (current !== null && current !== last) setLast(current);
  const id = current ?? last;
  const held = placed.find((p) => p.id === id) ?? null;
  return { held, shown: held ?? placed[0] ?? null };
}

/**
 * A scene's pages, read from its page nodes, with the view following them. Each edit is one of
 * core's page edits, so it moves what is on a page with it, in one undo entry. `padding` is what
 * fitting the view to a page leaves around it, in screen pixels. `setView` may be a view dep with
 * `animate`, and then going to a page and `'single'` paging's settle animate.
 */
export function usePages<TData, TLayer extends string, TPose>(
  sceneIn: Scene<TData, TLayer, TPose>,
  view: View,
  dims: { width: number; height: number },
  setView: ViewSink,
  padding = 24,
  options: UsePagesOptions = {},
): DocPages {
  const scene = sceneIn as unknown as AnyScene;
  const placed = usePlaced(scene);
  const current = dims.width > 0 && dims.height > 0 ? pageInView(placed, view, dims)?.id ?? null : null;
  const { held, shown } = useShown(placed, current);
  const latest = useLatest({ view, dims, setView, held });
  const result = useMemo<DocPages>(() => {
    const show = (page: PlacedPage | null | undefined) => {
      const { view: v, dims: d, setView: set } = latest.current;
      if (!page || d.width <= 0 || d.height <= 0) return;
      sendView(set, fitViewToPage(page, d, v, { padding }) ?? HOME_VIEW);
    };
    const goTo = (id: string) => show(placedPagesOf(scene).find((p) => p.id === id));
    return {
      placed,
      current,
      shown,
      goTo,
      step: (by) => {
        const all = placedPagesOf(scene);
        const from = latest.current.held;
        show(from ? adjacentPage(all, from.id, by) : all[0]);
      },
      add(options) {
        const pages = pagesOf(scene)?.pages ?? [];
        const at = pages.findIndex((p) => p.id === latest.current.held?.id);
        const like = pages[at] ?? pages[pages.length - 1];
        const place: PagePlace = { index: at < 0 ? pages.length : at + 1 };
        if (like) place.size = { width: like.width, height: like.height };
        const make = options?.make ?? (({ index, size }: PagePlace) => {
          const id = nextPageId(pages);
          addPage(scene, { id, ...(size ?? FIRST_PAGE) }, { index });
          return id;
        });
        goTo(make(place));
      },
      remove(id) {
        if ((pagesOf(scene)?.pages.length ?? 0) > 1) removePage(scene, id);
      },
      move: (id, index) => movePage(scene, id, index),
      rename: (id, name) => renamePage(scene, id, name),
      resize: (id, size) => resizePage(scene, id, size),
    };
  }, [scene, placed, current, shown, latest, padding]);
  usePageSettle(result, view, dims, setView, options.paging ?? 'continuous', padding);
  return result;
}
