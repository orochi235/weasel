import { layoutPages, pagesLayer, type PlacedPage, type RenderLayer } from '@weasel-js/core';
import { useMemo } from 'react';

export interface PageSize { width: number; height: number }

/** The document's pages: world-space rects filled with the document's background color, so the
 *  workspace stripes show everywhere outside them. */
export function usePaperLayer(pages: readonly PlacedPage[], backgroundColor: string): RenderLayer<unknown> {
  return useMemo<RenderLayer<unknown>>(
    () => pagesLayer(pages, { fill: backgroundColor, id: 'paper', label: 'Paper' }),
    [pages, backgroundColor],
  );
}

/** A one-page document's page, placed at the world origin, for {@link usePaperLayer}. */
export function useSinglePage(page: PageSize): readonly PlacedPage[] {
  return useMemo(() => layoutPages([{ id: 'page', width: page.width, height: page.height }]), [page.width, page.height]);
}
