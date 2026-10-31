import { contrastLineColor, type RenderLayer, type SnapSource } from '@weasel-js/core';
import { createGridLayer, gridSnapSource } from '@weasel-js/guides';
import { useMemo } from 'react';
import type { PageSize } from './paperLayer';

/** The page a `usePageGrid` grid covers, its pitch and look, and whether it shows and snaps. */
export interface PageGridOptions {
  /** The page the grid covers; its lines start at the page's corner, default world `(0, 0)`. */
  page: PageSize & { x?: number; y?: number };
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
  const x = page.x ?? 0;
  const y = page.y ?? 0;

  const layer = useMemo(() => createGridLayer({
    spacing,
    bounds: () => ({ x, y, width: page.width, height: page.height }),
    accentEvery,
    style: {
      line:   { paint: { kind: 'solid', color: contrastLineColor(background, 0.06) }, width: 1 },
      accent: { paint: { kind: 'solid', color: contrastLineColor(background, 0.14) }, width: 1 },
    },
  }), [spacing, x, y, page.width, page.height, background, accentEvery]);

  const source = useMemo(() => gridSnapSource({ spacing, origin: { x, y } }), [spacing, x, y]);

  return { layer: visible ? layer : undefined, source: snap ? source : undefined };
}
