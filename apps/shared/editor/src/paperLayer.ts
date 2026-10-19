import { layoutPages, pagesLayer, type RenderLayer } from '@weasel-js/core';
import { useMemo } from 'react';

export interface PageSize { width: number; height: number }

/** The document page: a world-space rect filled with the document's background color, so the
 *  workspace stripes show everywhere outside it. */
export function usePaperLayer(page: PageSize, backgroundColor: string): RenderLayer<unknown> {
  return useMemo<RenderLayer<unknown>>(
    () => pagesLayer(
      layoutPages([{ id: 'page', width: page.width, height: page.height }]),
      { fill: backgroundColor, id: 'paper', label: 'Paper' },
    ),
    [page.width, page.height, backgroundColor],
  );
}
