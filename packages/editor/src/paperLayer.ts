import { createPagesLayer, type PlacedPage, type RenderLayer } from '@weasel-js/core';
import { useMemo } from 'react';

/** A page's size, in world units. */
export interface PageSize { width: number; height: number }

/** The document's pages (`placedPagesOf`, or `usePages`' `placed`): world-space rects filled with the
 *  document's background color, so the workspace stripes show everywhere outside them. The page nodes
 *  draw nothing themselves; this is their paper. Empty in a document without pages. */
export function usePaperLayer(pages: readonly PlacedPage[], backgroundColor: string): RenderLayer<unknown> {
  return useMemo<RenderLayer<unknown>>(
    () => createPagesLayer(pages, { fill: backgroundColor, id: 'paper', label: 'Paper' }),
    [pages, backgroundColor],
  );
}
