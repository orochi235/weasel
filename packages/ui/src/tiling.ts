/**
 * Tiling: a run of same-size controls laid out as a grid `columns` across,
 * in reading order, with a short last row at its start, centered, or at its
 * end. One spec answers both how the run is drawn and how the arrow keys
 * walk it, so the two cannot disagree: spread {@link tiling}'s root props on
 * the container and its `rowLead` on the item it names, and hand
 * {@link tilingRoving}'s options to `useRovingTabIndex`.
 */
import type { CSSProperties } from 'react';
import { rowOffset, type UseRovingTabIndexOptions } from './useRovingTabIndex';
import s from './tiling.module.css';

/** How a run of controls tiles. */
export interface Tiling {
  /** Items per row. */
  columns: number;
  /** Where a last row shorter than `columns` sits. Default `'start'`. */
  lastRow?: 'start' | 'center' | 'end';
}

/** What a tiled container and its items spread. */
export interface TilingProps {
  className: string;
  style: CSSProperties;
  /** The index of the item that starts a short last row sitting off the start, which
   *  spreads {@link ROW_LEAD}; `-1` when no item does. */
  rowLead: number;
  /** How far that row sits from the start, in half-columns: the grid's track unit. */
  lead: number;
}

/** The attribute the item starting an offset last row carries. */
export const ROW_LEAD = { 'data-row-lead': '' } as const;

/** How `count` items tile under `spec`. */
export function tiling(count: number, spec: Tiling): TilingProps {
  const { columns } = spec;
  const short = count % columns;
  // Half-columns, the grid's track unit.
  const lead = short === 0 ? 0 : 2 * rowOffset(short, columns, spec.lastRow);
  return {
    className: s.tiles!,
    style: { '--tracks': 2 * columns, '--lead': lead } as CSSProperties,
    rowLead: lead > 0 ? count - short : -1,
    lead,
  };
}

/** The `useRovingTabIndex` options that walk a run tiled by `spec`. */
export function tilingRoving(spec: Tiling): Pick<UseRovingTabIndexOptions, 'columns' | 'lastRow'> {
  return { columns: spec.columns, lastRow: spec.lastRow };
}
