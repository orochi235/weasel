import { contrastLineColor, type RenderLayer, type SnapSource } from '@weasel-js/core';
import { createGridLayer, gridSnapSource } from '@weasel-js/guides';
import { useMemo } from 'react';
import type { PageSize } from './paperLayer';

export interface PageGridOptions {
  page: PageSize;
  spacing: number;
  /** The page's fill; line colors are derived from it for contrast. */
  background: string;
  /** Every Nth line is drawn as an accent. */
  accentEvery: number;
  visible: boolean;
  snap: boolean;
}

/**
 * A grid over the page: the layer to draw while `visible`, and the snap source to hand the
 * canvas while `snap` is on. Both keep their identity until their inputs change.
 */
export function usePageGrid(opts: PageGridOptions): { layer: RenderLayer<unknown> | undefined; source: SnapSource | undefined } {
  const { page, spacing, background, accentEvery, visible, snap } = opts;

  const layer = useMemo(() => createGridLayer({
    spacing,
    bounds: () => ({ x: 0, y: 0, width: page.width, height: page.height }),
    accentEvery,
    style: {
      line:   { paint: { kind: 'solid', color: contrastLineColor(background, 0.06) }, width: 1 },
      accent: { paint: { kind: 'solid', color: contrastLineColor(background, 0.14) }, width: 1 },
    },
  }), [spacing, page.width, page.height, background, accentEvery]);

  const source = useMemo(() => gridSnapSource({ spacing }), [spacing]);

  return { layer: visible ? layer : undefined, source: snap ? source : undefined };
}
