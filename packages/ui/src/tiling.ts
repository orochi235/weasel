/**
 * Tiling on the DOM: ui-input's `tileGrid` as a CSS grid. Spread
 * {@link tiling}'s `className` and `style` on the container and `item(i)` on
 * each item, and hand {@link tilingRoving}'s options to `useRovingTabIndex`,
 * which walks the same layout with ui-input's `rovingGridTarget`.
 */
import type { CSSProperties } from 'react';
import { tileGrid, type Tiling } from '@weasel-js/ui-input';
import type { UseRovingTabIndexOptions } from './useRovingTabIndex';
import s from './tiling.module.css';

/** The data attributes one tiled item spreads. */
export type TileAttrs = Partial<Record<`data-${string}`, string>>;

/** What a tiled container and its items spread. */
export interface TilingProps {
  className: string;
  style: CSSProperties;
  /** The attributes item `i` spreads: where an offset or stretched last row starts, and `data-tile-corners`,
   *  the outer corners of the grid it sits on (`tileGrid`'s `corners`), for a container that draws one well
   *  around them. */
  item(i: number): TileAttrs;
  /** How far an offset last row sits from the start, in tracks; 0 for one at the start, stretched, or none. */
  lead: number;
}

/** How `count` items tile under `spec`, as a CSS grid. */
export function tiling(count: number, spec: Tiling): TilingProps {
  const grid = tileGrid(count, spec);
  return {
    className: s.tiles!,
    style: { '--tracks': grid.tracks, '--span': grid.span, '--fill-span': grid.fillSpan, '--lead': grid.lead } as CSSProperties,
    item: (i) => {
      const attrs: TileAttrs = {};
      const corners = grid.corners(i).join(' ');
      if (corners) attrs['data-tile-corners'] = corners;
      if (i === grid.lastStart && grid.lead > 0) attrs['data-row-lead'] = '';
      if (grid.stretched(i)) attrs['data-row-fill'] = '';
      return attrs;
    },
    lead: grid.lead,
  };
}

/** The `useRovingTabIndex` options that walk a run tiled by `spec`. */
export function tilingRoving(spec: Tiling): Pick<UseRovingTabIndexOptions, 'columns' | 'lastRow'> {
  return { columns: spec.columns, lastRow: spec.lastRow };
}
