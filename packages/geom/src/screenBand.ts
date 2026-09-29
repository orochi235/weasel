/**
 * Is a point within `px` screen pixels of a world-space stroke band?
 *
 * The band is a capsule of radius `r` around each segment, in the frame the
 * path lives in; `m` is the linear part of that frame's map to the screen.
 * Under a similarity the answer is a plain world distance, `r + px / scale`.
 * Under anything else the capsule lands on screen as a parallelogram capped by
 * two ellipses, and the pixel slop has to be measured against that shape:
 * neither a scalar nor a per-axis world tolerance describes it.
 */
import { pointSegmentDist2 } from './polyline';

/** Linear part of a map to the screen: `x' = a·x + c·y`, `y' = b·x + d·y`. */
export interface Linear2 {
  a: number; b: number; c: number; d: number;
}

/** A linear map's singular decomposition, as much of it as the band test
 *  needs: the two stretch factors, and the screen-space angle of the first. */
export interface Stretch {
  s1: number;
  s2: number;
  /** Angle of the first singular direction on screen. */
  phi: number;
}

export function stretchOf(m: Linear2): Stretch {
  // Closed-form 2×2 SVD. M = R(phi) · diag(Q + R, Q − R) · R(theta).
  const e = (m.a + m.d) / 2;
  const f = (m.a - m.d) / 2;
  const g = (m.b + m.c) / 2;
  const h = (m.b - m.c) / 2;
  const q = Math.hypot(e, h);
  const r = Math.hypot(f, g);
  const phi = (Math.atan2(h, e) + Math.atan2(g, f)) / 2;
  return { s1: q + r, s2: Math.abs(q - r), phi };
}

/** True when the map scales every direction alike, so a screen length is one
 *  world length. */
export function isSimilarity(s: Stretch): boolean {
  return s.s1 - s.s2 <= 1e-9 * s.s1;
}

/**
 * Screen point `(px0, py0)` against the image of one world capsule
 * `(ax, ay)–(bx, by)`, radius `r`, grown by `slop` pixels. `m`/`st` map world
 * to screen (linear part only — every point shares the translation).
 */
export function capsuleWithinPx(
  px0: number, py0: number,
  ax: number, ay: number, bx: number, by: number,
  r: number, slop: number,
  m: Linear2, st: Stretch,
): boolean {
  const sax = m.a * ax + m.c * ay, say = m.b * ax + m.d * ay;
  const sbx = m.a * bx + m.c * by, sby = m.b * bx + m.d * by;
  const slop2 = slop * slop;
  const dCenter2 = pointSegmentDist2(px0, py0, sax, say, sbx, sby);
  if (dCenter2 <= slop2) return true;
  if (r <= 0) return false;
  // Nothing in the band is farther from the centerline than r·s1 on screen.
  const reach = slop + r * st.s1;
  if (dCenter2 > reach * reach) return false;

  // The parallelogram: the capsule's straight part, carried to the screen.
  const wx = bx - ax, wy = by - ay;
  const wl = Math.hypot(wx, wy);
  if (wl > 0) {
    const nx = (-wy / wl) * r, ny = (wx / wl) * r;
    const ox = m.a * nx + m.c * ny, oy = m.b * nx + m.d * ny;
    if (quadWithinPx(px0, py0, [
      sax + ox, say + oy, sbx + ox, sby + oy,
      sbx - ox, sby - oy, sax - ox, say - oy,
    ], slop2)) return true;
  }
  // The round caps: each end's disk lands on screen as an ellipse.
  return ellipseWithinPx(px0 - sax, py0 - say, r, slop, st)
    || ellipseWithinPx(px0 - sbx, py0 - sby, r, slop, st);
}

/** Inside a convex quad, or within `sqrt(slop2)` of one of its edges. */
function quadWithinPx(x: number, y: number, q: readonly number[], slop2: number): boolean {
  let pos = 0, neg = 0;
  for (let i = 0; i < 8; i += 2) {
    const j = (i + 2) % 8;
    const cr = (q[j] - q[i]) * (y - q[i + 1]) - (q[j + 1] - q[i + 1]) * (x - q[i]);
    if (cr > 0) pos++;
    else if (cr < 0) neg++;
  }
  if (pos === 0 || neg === 0) return true;
  for (let i = 0; i < 8; i += 2) {
    const j = (i + 2) % 8;
    if (pointSegmentDist2(x, y, q[i], q[i + 1], q[j], q[j + 1]) <= slop2) return true;
  }
  return false;
}

/** `(dx, dy)` from the center of the filled ellipse `M(disk r)`, within `slop`? */
function ellipseWithinPx(dx: number, dy: number, r: number, slop: number, st: Stretch): boolean {
  const cos = Math.cos(st.phi), sin = Math.sin(st.phi);
  const u = Math.abs(cos * dx + sin * dy);
  const v = Math.abs(-sin * dx + cos * dy);
  const e0 = r * st.s1, e1 = r * st.s2;
  if (e1 <= 0) {
    // Collapsed to a segment along the first axis.
    const over = Math.max(0, u - e0);
    return over * over + v * v <= slop * slop;
  }
  return distToEllipse(e0, e1, u, v) <= slop;
}

/**
 * Distance from `(y0, y1)`, first quadrant, to the filled axis-aligned ellipse
 * with semi-axes `e0 >= e1 > 0`. Eberly, "Distance from a Point to an
 * Ellipse" — bisection on the Lagrange root, robust near the axes.
 */
function distToEllipse(e0: number, e1: number, y0: number, y1: number): number {
  const z0 = y0 / e0, z1 = y1 / e1;
  const g = z0 * z0 + z1 * z1 - 1;
  if (g <= 0) return 0;
  if (y1 > 0) {
    if (y0 > 0) {
      const r0 = (e0 / e1) * (e0 / e1);
      const n0 = r0 * z0;
      let s0 = z1 - 1;
      let s1 = Math.hypot(n0, z1) - 1;
      let s = 0;
      for (let i = 0; i < 100; i++) {
        s = (s0 + s1) / 2;
        if (s === s0 || s === s1) break;
        const a = n0 / (s + r0), b = z1 / (s + 1);
        const gs = a * a + b * b - 1;
        if (gs > 0) s0 = s;
        else if (gs < 0) s1 = s;
        else break;
      }
      const x0 = (r0 * y0) / (s + r0);
      const x1 = y1 / (s + 1);
      return Math.hypot(x0 - y0, x1 - y1);
    }
    return y1 - e1;
  }
  const numer = e0 * y0, denom = e0 * e0 - e1 * e1;
  if (numer < denom) {
    const t = numer / denom;
    const x0 = e0 * t, x1 = e1 * Math.sqrt(1 - t * t);
    return Math.hypot(x0 - y0, x1);
  }
  return y0 - e0;
}
