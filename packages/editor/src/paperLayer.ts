import { pagesLayer, type PlacedPage, type RenderLayer } from '@weasel-js/core';
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
