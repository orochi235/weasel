import { clipToAncestors } from './clip';
import { composeRects, rectsEqual } from './composeRects';
import type { Box, Rect } from './rect';

/** Where every tile is, and how much of each shows. Both against the
 *  container's origin, keyed alike. */
export interface TileGeometry {
  rects: Map<string, Rect>;
  visible: Map<string, Rect>;
}

/** Measure every tile inside `scope` (all of them, with none) against `container`. */
export function measureTiles(
  container: HTMLElement,
  tiles: ReadonlyMap<string, HTMLElement>,
  scope: HTMLElement | null,
): TileGeometry {
  const boxes = new Map<string, Box>();
  const shown = new Map<string, Box>();
  for (const [id, tile] of tiles) {
    if (scope && !scope.contains(tile)) continue;
    const box = tile.getBoundingClientRect();
    boxes.set(id, box);
    shown.set(id, clipToAncestors(tile, box));
  }
  const origin = container.getBoundingClientRect();
  return { rects: composeRects(origin, boxes), visible: composeRects(origin, shown) };
}

export function sameRects(a: ReadonlyMap<string, Rect>, b: ReadonlyMap<string, Rect>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, rect] of b) {
    if (!rectsEqual(a.get(id), rect)) return false;
  }
  return true;
}
