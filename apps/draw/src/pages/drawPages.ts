import { createPageRun, type NodeId, pagesOf, type PagesDoc, type Scene } from '@weasel-js/core';
import type { PageSize } from '@weasel-js/editor';
import { DEFAULT_PAPER_SIZE, PAPER_PRESETS, PAPER_SIZES, type PaperSizeKey } from '../paperSizes';

/** A document of one page of `size`: a new document, and one saved before draw had pages. */
export function onePage(size: PageSize): PagesDoc {
  return { pages: [{ id: 'page-1', width: size.width, height: size.height }] };
}

/** The paper size a page is, or `null` for a size draw does not offer. */
export function paperSizeOf(size: PageSize): PaperSizeKey | null {
  return PAPER_SIZES.find((p) => p.width === size.width && p.height === size.height)?.key ?? null;
}

/** The size of the scene's first page, or the default paper's for a scene with none. */
export function firstPageSize<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): PageSize {
  const first = pagesOf(scene)?.pages[0];
  return first ? { width: first.width, height: first.height } : PAPER_PRESETS[DEFAULT_PAPER_SIZE];
}

/** Empty the scene, locked content and pages included, and give it a new page run of `pages`. Returns the
 *  run. Call inside the batch that replaces the document. */
export function replacePages<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>, pages: PagesDoc): NodeId {
  scene.unlocked(() => { if (scene.roots.length > 0) scene.removeMany([...scene.roots]); });
  return createPageRun(scene, pages.pages, pages.layout);
}
