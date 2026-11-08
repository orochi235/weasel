/**
 * Tiling: a run of same-size controls laid out as a grid `columns` across,
 * in reading order, with a short last row at its start, centered, at its end,
 * or stretched to fill the row. One spec answers both how the run is drawn
 * and how the arrow keys walk it, so the two cannot disagree: spread
 * {@link tiling}'s `className` and `style` on the container and `item(i)` on
 * each item, and hand {@link tilingRoving}'s options to `useRovingTabIndex`.
 */
import type { CSSProperties } from 'react';
import { rowOffset, type UseRovingTabIndexOptions } from './useRovingTabIndex';
import s from './tiling.module.css';

/** Where a last row shorter than the rest sits: at the start, centered, at the end, or with its items stretched
 *  across the whole row. */
export type LastRow = 'start' | 'center' | 'end' | 'fill';

/** How a run of controls tiles. */
export interface Tiling {
  /** Items per row. */
  columns: number;
  /** Where a last row shorter than `columns` sits. Default `'start'`. */
  lastRow?: LastRow;
}

/** The data attributes one tiled item spreads. */
export type TileAttrs = Partial<Record<`data-${string}`, string>>;

/** What a tiled container and its items spread. */
export interface TilingProps {
  className: string;
  style: CSSProperties;
  /** The attributes item `i` spreads: where an offset or stretched last row starts, and `data-tile-corners`,
   *  the outer corners of the grid it sits on (`ss` top-left, `se` top-right, `es` bottom-left, `ee`
   *  bottom-right, in the inline direction), for a container that draws one well around them. */
  item(i: number): TileAttrs;
  /** How far an offset last row sits from the start, in half-columns; 0 for one at the start, stretched, or none. */
  lead: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** The grid's tracks, and how many of them a full row's item and a stretched last row's item span. */
function tracksOf(columns: number, short: number, lastRow: LastRow): { tracks: number; span: number; fill: number } {
  if (lastRow === 'fill' && short > 0) {
    const tracks = (columns * short) / gcd(columns, short);
    return { tracks, span: tracks / columns, fill: tracks / short };
  }
  // Half-column tracks, so a short last row can sit centered between two columns.
  return { tracks: 2 * columns, span: 2, fill: 2 };
}

/** How `count` items tile under `spec`. */
export function tiling(count: number, spec: Tiling): TilingProps {
  const { columns } = spec;
  const lastRow = spec.lastRow ?? 'start';
  const short = count % columns;
  const lastStart = count - (short || columns);
  const lead = short === 0 || lastRow === 'fill' ? 0 : 2 * rowOffset(short, columns, lastRow);
  const { tracks, span, fill } = tracksOf(columns, short, lastRow);
  // The last item reaches the end of its row when the row is full, stretched or end-aligned.
  const lastAtEnd = short === 0 || lastRow === 'fill' || lastRow === 'end';
  const corners = (i: number): string => [
    i === 0 && 'ss',
    i === Math.min(columns, count) - 1 && 'se',
    i === lastStart && (lead === 0 || lastStart === 0) && 'es',
    i === count - 1 && lastAtEnd && 'ee',
  ].filter(Boolean).join(' ');
  return {
    className: s.tiles!,
    style: { '--tracks': tracks, '--span': span, '--fill-span': fill, '--lead': lead } as CSSProperties,
    item: (i) => {
      const attrs: TileAttrs = {};
      const c = corners(i);
      if (c) attrs['data-tile-corners'] = c;
      if (i === lastStart && lead > 0) attrs['data-row-lead'] = '';
      if (i >= lastStart && short > 0 && lastRow === 'fill') attrs['data-row-fill'] = '';
      return attrs;
    },
    lead,
  };
}

/** The `useRovingTabIndex` options that walk a run tiled by `spec`. */
export function tilingRoving(spec: Tiling): Pick<UseRovingTabIndexOptions, 'columns' | 'lastRow'> {
  return { columns: spec.columns, lastRow: spec.lastRow };
}
