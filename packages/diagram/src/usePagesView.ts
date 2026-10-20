import { pagesBounds, pagesLayer } from '@weasel-js/core';
import { useMemo } from 'react';
import type { DiagramViewProps } from './diagramViewProps';

/** What `DiagramView`'s `pages` prop adds: the layer that paints them under the scene, and their bounds for the fit. */
export function usePagesView(pages: DiagramViewProps['pages']) {
  return useMemo(() => {
    if (pages === undefined) return { layers: undefined, box: undefined };
    return {
      layers: { pages: { layer: pagesLayer(pages.placed, { fill: pages.fill }), before: 'scene' as const } },
      box: pagesBounds(pages.placed) ?? undefined,
    };
  }, [pages]);
}
