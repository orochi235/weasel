import { contrastLineColor, type RenderLayer, type SnapSource } from '@weasel-js/core';
import { createGridLayer, gridSnapSource } from '@weasel-js/guides';
import { pref, type PrefValuesOf } from '@weasel-js/prefs';
import { useMemo } from 'react';
import type { PageSize } from './paperLayer';

/** A page grid's settings as a prefs group: mount it in an app's schema and pass its values to `usePageGrid`. */
export const pageGridSchema = pref.group('Grid', {
  visible: pref.boolean('Show grid', false, { description: 'Display the grid overlay on the canvas.' }),
  spacing: pref.number('Grid density', 20, {
    description: 'Spacing between grid lines, in document units (CSS pixels, 96 to the inch). Snap to grid uses the same spacing.',
    min: 4, max: 288, step: 4, control: 'slider',
  }),
  accentEvery: pref.number('Accent every', 5, {
    description: 'Every this many lines, one is drawn darker.', min: 1, max: 20, step: 1,
  }),
  snap: pref.boolean('Snap to grid', false, { description: 'Constrain move/resize gestures to grid intersections.' }),
});

/** A page grid's settings: what `pageGridSchema` holds. */
export type PageGridSettings = PrefValuesOf<typeof pageGridSchema>;

/** A page grid's settings, plus the page it covers and the fill its line colors contrast with. */
export interface PageGridOptions extends PageGridSettings {
  /** The page the grid covers; its lines start at the page's corner, default world `(0, 0)`. */
  page: PageSize & { x?: number; y?: number };
  /** The page's fill; line colors are derived from it for contrast. */
  background: string;
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
