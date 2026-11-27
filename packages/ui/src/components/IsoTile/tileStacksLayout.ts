import type { TileItem } from './IsoTile';

/** The sizes a stack chart is drawn at, in SVG units. */
export interface TileStacksSizes {
  pitch: number;
  tileWidth: number;
  tileHeight: number;
  depth: number;
  /** Room left past the last column for the trailing label; 0 when there is none. */
  trailingWidth: number;
}

const AXIS = 13;

/** Column numbers to label: the first and every fifth, within the span. */
export const defaultTicksFor = (span: number): number[] =>
  [1, ...Array.from({ length: Math.floor(span / 5) }, (_, i) => (i + 1) * 5)].filter((t) => t <= span);

/** Where every tile, empty patch and label of a stack chart goes, and the chart's size. Columns are numbered from 1. */
export function stacksLayoutFor(columns: readonly (readonly TileItem[])[], span: number, sz: TileStacksSizes) {
  const { pitch, tileWidth, tileHeight, depth } = sz;
  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const base = depth + tallest * tileHeight + 2;
  const colX = (column: number) => (column - 1) * pitch;
  const trailingX = columns.length * pitch + 6;
  const tiles = columns.flatMap((col, i) => col.map((item, k) => ({ item, column: i + 1, x: colX(i + 1), y: base - (k + 1) * tileHeight })));
  const empties = columns.flatMap((col, i) => (col.length ? [] : [{ column: i + 1, x: colX(i + 1) }]));
  return {
    tiles,
    empties,
    base,
    axisEnd: span * pitch,
    trailingX,
    tickX: (column: number) => colX(column) + tileWidth / 2,
    width: Math.max(span * pitch, sz.trailingWidth ? trailingX + sz.trailingWidth : 0),
    height: base + AXIS,
  };
}
