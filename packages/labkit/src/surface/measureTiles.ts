import { clipToAncestors } from './clip';
import { composeRects, rectsEqual } from './composeRects';
import type { Box, Rect } from './rect';

/** Where every tile is, and how much of each shows. Both against the
 *  container's origin, keyed alike. */
export interface TileGeometry {
  rects: Map<string, Rect>;
  visible: Map<string, Rect>;
}

/** What a surface is narrowed to: the tiles inside an element, or inside any
 *  of several. Null is every tile. */
export type SurfaceScope = HTMLElement | readonly HTMLElement[] | null;

/** Whether `tile` is inside `scope`. */
export function scopeHolds(scope: SurfaceScope, tile: Node): boolean {
  if (!scope) return true;
  if ('contains' in scope) return scope.contains(tile);
  return scope.some((el) => el.contains(tile));
}

/** Whether two scopes name the same elements, in the same order. */
export function sameScope(a: SurfaceScope, b: SurfaceScope): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return a.length === b.length && a.every((el, i) => el === b[i]);
}

/** Measure every tile inside `scope` (all of them, with none) against `container`. */
export function measureTiles(
  container: HTMLElement,
  tiles: ReadonlyMap<string, HTMLElement>,
  scope: SurfaceScope,
): TileGeometry {
  const boxes = new Map<string, Box>();
  const shown = new Map<string, Box>();
  for (const [id, tile] of tiles) {
    if (!scopeHolds(scope, tile)) continue;
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
