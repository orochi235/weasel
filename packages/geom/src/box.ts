/** Axis-aligned box as [minX, minY, maxX, maxY]. */
export type Box = [number, number, number, number];

/** An axis-aligned rectangle in object form. `Box` is the tuple form; this is
 *  the one that survives being read by a human. */
export interface Rect { x: number; y: number; width: number; height: number }

/** Tight bounds of an interleaved coord stream, or null if empty. */
export function boundsOfCoords(coords: ArrayLike<number>): Box | null {
  if (coords.length < 2) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Smallest box containing both inputs. */
export function unionBox(a: Box, b: Box): Box {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

/** Inclusive point-in-box test. */
export function boxContainsPoint(b: Box, x: number, y: number): boolean {
  return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
}

/** Interleaved corner ring for a rect at (x,y,w,h), wound clockwise from the
 *  origin corner. The closing edge is implicit — the same unclosed shape
 *  `pointInPolygon` takes, and what a repeated first vertex would leave as a
 *  zero-length segment for anything that strokes it. */
export function rectToContour(x: number, y: number, w: number, h: number): Float64Array {
  return Float64Array.of(x, y, x + w, y, x + w, y + h, x, y + h);
}
