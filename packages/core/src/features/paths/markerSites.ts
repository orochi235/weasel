/**
 * Where a stroke's markers sit and which way they point.
 *
 * Computed from the *untrimmed* polyline: trimming moves the endpoint, and a
 * marker anchors to where the line was authored to end, not to where the
 * ribbon was cut.
 */

import type { Polyline } from './tessellate/polyline';

export interface MarkerSite {
  x: number;
  y: number;
  /** Radians. The direction the marker's +X axis should point — outward at a
   *  start or end, along the bisector at an interior vertex. */
  angle: number;
  role: 'start' | 'mid' | 'end';
}

export interface MarkerSiteRequest {
  start: boolean;
  mid: boolean;
  end: boolean;
}

const EPS = 1e-9;

/** Unit direction from point `i` to point `j`, or null if they coincide. */
function dir(pl: Polyline, i: number, j: number): { x: number; y: number } | null {
  const dx = pl.points[j * 2] - pl.points[i * 2];
  const dy = pl.points[j * 2 + 1] - pl.points[i * 2 + 1];
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: dx / len, y: dy / len };
}

/** The first index after `i` whose point differs from `i`'s. */
function nextDistinct(pl: Polyline, i: number, n: number): number {
  for (let k = i + 1; k < n; k++) if (dir(pl, i, k)) return k;
  return -1;
}
function prevDistinct(pl: Polyline, i: number): number {
  for (let k = i - 1; k >= 0; k--) if (dir(pl, k, i)) return k;
  return -1;
}

export function markerSites(pl: Polyline, want: MarkerSiteRequest): MarkerSite[] {
  const out: MarkerSite[] = [];
  const n = pl.points.length / 2;
  if (n < 2) return out;

  if (want.start && !pl.closed) {
    const j = nextDistinct(pl, 0, n);
    const d = j >= 0 ? dir(pl, 0, j) : null;
    if (d) {
      // Reversed, so a start head points away from the line body the way an
      // end head does. SVG spells this `auto-start-reverse`; here it is the
      // only behavior.
      out.push({ x: pl.points[0], y: pl.points[1], angle: Math.atan2(-d.y, -d.x), role: 'start' });
    }
  }

  if (want.mid) {
    const A = pl.anchorA, B = pl.anchorB, T = pl.anchorT;
    if (A && B && T) {
      for (let i = 1; i < n - 1; i++) {
        // An authored anchor, not a flattened curve sample.
        if (A[i] !== B[i] || T[i] !== 0) continue;
        const p = prevDistinct(pl, i);
        const q = nextDistinct(pl, i, n);
        if (p < 0 || q < 0) continue;
        const inDir = dir(pl, p, i)!;
        const outDir = dir(pl, i, q)!;
        let bx = inDir.x + outDir.x;
        let by = inDir.y + outDir.y;
        // A 180° reversal leaves no bisector; fall back to the arriving direction.
        if (Math.hypot(bx, by) < EPS) { bx = inDir.x; by = inDir.y; }
        out.push({ x: pl.points[i * 2], y: pl.points[i * 2 + 1], angle: Math.atan2(by, bx), role: 'mid' });
      }
    }
  }

  if (want.end && !pl.closed) {
    const last = n - 1;
    const p = prevDistinct(pl, last);
    const d = p >= 0 ? dir(pl, p, last) : null;
    if (d) {
      out.push({ x: pl.points[last * 2], y: pl.points[last * 2 + 1], angle: Math.atan2(d.y, d.x), role: 'end' });
    }
  }

  return out;
}
