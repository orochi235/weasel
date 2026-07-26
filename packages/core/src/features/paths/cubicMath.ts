export interface Point { x: number; y: number; }

interface AnchorRef {
  x: number; y: number;
  inHandle?: Point;
  outHandle?: Point;
}

/**
 * De Casteljau subdivision of a cubic Bezier at parameter t ∈ [0, 1].
 * Returns the two halves as cubic control-point tuples. The point at parameter
 * t on the original curve is shared between `left[3]` and `right[0]`.
 */
export function splitCubicAtT(
  p0: Point, p1: Point, p2: Point, p3: Point,
  t: number,
): { left: [Point, Point, Point, Point]; right: [Point, Point, Point, Point] } {
  const lerp = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const q0 = lerp(p0, p1);
  const q1 = lerp(p1, p2);
  const q2 = lerp(p2, p3);
  const r0 = lerp(q0, q1);
  const r1 = lerp(q1, q2);
  const s0 = lerp(r0, r1);
  return {
    left: [p0, q0, r0, s0],
    right: [s0, r1, q2, p3],
  };
}

/**
 * When an interior anchor is deleted, the two flanking segments fuse into one
 * cubic. We pick controls c1 and c2 that:
 *   - lie along prev's outHandle direction (if present)
 *   - lie along next's inHandle direction (if present)
 *   - are placed at roughly 1/3 and 2/3 of the prev→next distance
 * Fallbacks: missing handles use prev→next as the direction.
 *
 * This is an approximate fit — the new curve will shift slightly from the
 * original two-segment path. Acceptable per spec.
 */
export function fitCubicThroughDeletion(
  prev: AnchorRef,
  next: AnchorRef,
): { c1: Point; c2: Point } {
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // c1: project along outHandle direction (or prev→next fallback) at 1/3 of dist.
  const c1DirX = prev.outHandle ? prev.outHandle.x - prev.x : dx;
  const c1DirY = prev.outHandle ? prev.outHandle.y - prev.y : dy;
  const c1 = controlOnSide(prev, c1DirX, c1DirY, dist, 1 / 3);
  // c2: project along inHandle direction (or next→prev fallback) at 1/3 of dist.
  const c2DirX = next.inHandle ? next.inHandle.x - next.x : -dx;
  const c2DirY = next.inHandle ? next.inHandle.y - next.y : -dy;
  const c2 = controlOnSide(next, c2DirX, c2DirY, dist, 1 / 3);
  return { c1, c2 };
}

function controlOnSide(
  anchor: AnchorRef,
  dirX: number,
  dirY: number,
  dist: number,
  fraction: number,
): Point {
  const targetDist = dist * fraction;
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len, uy = dirY / len;
  return { x: anchor.x + ux * targetDist, y: anchor.y + uy * targetDist };
}
