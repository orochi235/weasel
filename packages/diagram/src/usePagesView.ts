import { pagesBounds, pagesLayer } from '@weasel-js/core';
import { useMemo } from 'react';
import type { DiagramViewProps } from './diagramViewProps';

/** What `DiagramView`'s `pages` prop adds: the layer that paints them under the scene, and their bounds for the fit.
 *  Keyed on the placed array and the fill, so a `pages` object built inline each render changes nothing. */
export function usePagesView(pages: DiagramViewProps['pages']) {
  const placed = pages?.placed;
  const fill = pages?.fill;
  return useMemo(() => {
    if (placed === undefined || fill === undefined) return { layers: undefined, box: undefined };
    return {
      layers: { pages: { layer: pagesLayer(placed, { fill }), before: 'scene' as const } },
      box: pagesBounds(placed) ?? undefined,
    };
  }, [placed, fill]);
}
