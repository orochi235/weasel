/**
 * Which side of a contour a set of closed contours fills under `'nonzero'`,
 * read by winding numbers rather than by the contour's own orientation, so a
 * separate shape wound the other way is told from a hole.
 */
import { lerp } from '../scalar';
import { splitSegment, type CubicSegment } from './cubicContours';

const MAX_DEPTH = 40;

/** Net signed crossings of the ray from `(px, py)` in +x by one cubic. Only a
 *  piece whose control box holds the point is split; any other piece crosses
 *  the ray as its chord does. */
function crossings(c: CubicSegment['c'], px: number, py: number, depth: number): number {
  const minX = Math.min(c[0], c[2], c[4], c[6]), maxX = Math.max(c[0], c[2], c[4], c[6]);
  if (maxX <= px) return 0;
  const minY = Math.min(c[1], c[3], c[5], c[7]), maxY = Math.max(c[1], c[3], c[5], c[7]);
  if (minY > py || maxY <= py) return 0;
  const a = c[1] > py, b = c[7] > py;
  if (minX > px || depth >= MAX_DEPTH) {
    if (a === b) return 0;
    const x = lerp(c[0], c[6], (py - c[1]) / (c[7] - c[1]));
    return x > px ? (b ? 1 : -1) : 0;
  }
  const [l, r] = splitSegment({ c, line: false }, 0.5);
  return crossings(l.c, px, py, depth + 1) + crossings(r.c, px, py, depth + 1);
}

/** The winding number of `(px, py)` under `contours`, each closed. */
export function windingOf(contours: readonly (readonly CubicSegment[])[], px: number, py: number): number {
  let w = 0;
  for (const segs of contours) for (const s of segs) w += crossings(s.c, px, py, 0);
  return w;
}

/**
 * Which way `contours[i]`'s outside lies: `1` when it is to the right of the
 * contour's direction of travel (y down: `[ty, -tx]` for tangent `t`), `-1`
 * when to the left, by which side of it `contours` leaves unfilled under
 * `'nonzero'`. `null` when neither side or both are unfilled, as for a contour
 * inside the fill or one with no area.
 */
export function outsideSide(contours: readonly (readonly CubicSegment[])[], i: number): 1 | -1 | null {
  const segs = contours[i]!;
  let seg: CubicSegment | undefined;
  let longest = 0;
  for (const s of segs) {
    const len = Math.hypot(s.c[6] - s.c[0], s.c[7] - s.c[1]);
    if (len > longest) { longest = len; seg = s; }
  }
  if (!seg) return null;
  const [l] = splitSegment(seg, 0.5);
  const mx = l.c[6], my = l.c[7];
  let tx = l.c[6] - l.c[4], ty = l.c[7] - l.c[5];
  if (tx === 0 && ty === 0) { tx = seg.c[6] - seg.c[0]; ty = seg.c[7] - seg.c[1]; }
  const tl = Math.hypot(tx, ty);
  const eps = longest * 1e-4;
  const nx = (ty / tl) * eps, ny = (-tx / tl) * eps;
  const right = windingOf(contours, mx + nx, my + ny) === 0;
  const left = windingOf(contours, mx - nx, my - ny) === 0;
  return right === left ? null : right ? 1 : -1;
}
