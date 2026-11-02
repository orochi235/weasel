/** Axis-aligned box as [minX, minY, maxX, maxY]. */
export type Box = readonly [number, number, number, number];

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

/** Whether `outer` wholly holds `inner`, edges inclusive. Two boxes that merely
 *  overlap answer false. */
export function boxContainsBox(outer: Box, inner: Box): boolean {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
}

/** Interleaved corner ring for a rect at (x,y,w,h), wound clockwise from the
 *  origin corner. The closing edge is implicit — the same unclosed shape
 *  `pointInPolygon` takes, and what a repeated first vertex would leave as a
 *  zero-length segment for anything that strokes it. */
export function rectToContour(x: number, y: number, w: number, h: number): Float64Array {
  return Float64Array.of(x, y, x + w, y, x + w, y + h, x, y + h);
}

/** Whether `a` and `b` meet, edges inclusive: boxes touching along an edge or
 *  at a corner answer true. */
export function boxesIntersect(a: Box, b: Box): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

/** Whether `a` and `b` share interior: rects that only touch along an edge or
 *  at a corner answer false. */
export function rectsOverlap(a: Readonly<Rect>, b: Readonly<Rect>): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Whether `a` and `b` meet, edges inclusive: rects touching along an edge or
 *  at a corner answer true. {@link rectsOverlap} is the interior-only test. */
export function rectsIntersect(a: Readonly<Rect>, b: Readonly<Rect>): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

/** Inclusive point-in-rect test: a point on any edge is inside. */
export function rectContainsPoint(r: Readonly<Rect>, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

/** Half-open point-in-rect test: the left and top edges are inside, the right
 *  and bottom ones outside, so rects that tile a plane never both claim a point. */
export function rectContainsPointHalfOpen(r: Readonly<Rect>, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
}

/** Smallest rect containing every one of `rects`, or null for none. A `NaN`
 *  coordinate makes the matching edge of the result `NaN`. */
export function unionRects(rects: Iterable<Readonly<Rect>>): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  for (const r of rects) {
    any = true;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return any ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
}
