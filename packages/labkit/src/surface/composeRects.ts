import type { Box, Rect } from './rect';

/** Every tile's box expressed against the container's origin. */
export function composeRects(container: Box, tiles: ReadonlyMap<string, Box>): Map<string, Rect> {
  const out = new Map<string, Rect>();
  for (const [id, tile] of tiles) {
    out.set(id, {
      x: tile.left - container.left,
      y: tile.top - container.top,
      width: tile.width,
      height: tile.height,
    });
  }
  return out;
}

export function rectsEqual(a: Rect | undefined, b: Rect): boolean {
  return (
    a !== undefined && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}
