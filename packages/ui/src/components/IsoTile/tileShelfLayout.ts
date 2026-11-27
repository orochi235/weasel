import type { TileItem } from './IsoTile';

/** One tile on a shelf: a `TileItem` that may carry a dot above it. */
export interface TileShelfItem extends TileItem {
  /** Draws a dot above the tile. */
  marked?: boolean;
}

/** A labeled run of tiles standing together on a shelf. */
export interface TileShelfGroup {
  key: string;
  label: string;
  items: readonly TileShelfItem[];
}

/** The sizes a shelf is drawn at, in SVG units. */
export interface TileShelfSizes {
  tileWidth: number;
  gap: number;
  groupGap: number;
  depth: number;
}

/** Each group's tiles along the shelf with their x, the group's label x, and the shelf's width. */
export function shelfLayoutFor(groups: readonly TileShelfGroup[], { tileWidth, gap, groupGap, depth }: TileShelfSizes) {
  let x = 0;
  const placed = groups.map((group) => {
    const start = x;
    const tiles = group.items.map((item) => {
      const tile = { item, x };
      x += tileWidth + gap;
      return tile;
    });
    const end = x - gap + depth;
    x = end + groupGap;
    return { group, tiles, labelX: (start + end) / 2 };
  });
  return { groups: placed, width: Math.max(0, x - groupGap) };
}
