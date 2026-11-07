/**
 * Where a stroke's markers sit and which way they point.
 *
 * Computed from the polyline before any head's inset is cut from it. A head
 * with no inset sits on the line's end; one the line stops short of sits on
 * the cut, pointing along the line there.
 */

import { type Polyline, trimPolyline } from '@weasel-js/geom/tessellate';

/** One marker placement, in the polyline's own coordinates. */
export interface MarkerSite {
  x: number;
  y: number;
  /** Radians. The direction the marker's +X axis should point — outward at a
   *  start or end, along the bisector at an interior vertex. */
  angle: number;
  role: 'start' | 'mid' | 'end';
}

/** How far the line stops short of the start and end heads, in the polyline's units. */
export interface MarkerSiteInsets {
  start?: number;
  end?: number;
}

/** Which marker roles to place. `start` and `end` are ignored on a closed polyline,
 *  and on a run cut from one. */
export interface MarkerSiteRequest {
  start: boolean;
  mid: boolean;
  end: boolean;
}

const EPS = 1e-9;
/** A line that never leaves its first point has no direction; SVG orients its heads along x. */
const X_AXIS = { x: 1, y: 0 };

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

/**
 * Where each requested marker sits on `pl` and the angle it points at.
 * Mid sites fall only on authored vertices, never on flattened curve samples,
 * and need the polyline to carry anchor data; without it no mid sites are returned.
 * `pl`'s first and last points are never mid sites, so a trimmed run's ends are ends.
 * `fromClosed` marks an open run cut from a closed subpath, which takes no start or end site.
 * A head the line stops `insets` short of is seated on the shortened line: its back on the
 * line's cut end and its axis along the line there, so a curving shaft enters the back of the
 * head square. Its tip then sits `inset` past the cut, along that axis.
 */
export function markerSites(
  pl: Polyline,
  want: MarkerSiteRequest,
  fromClosed = pl.closed,
  insets: MarkerSiteInsets = {},
): MarkerSite[] {
  const out: MarkerSite[] = [];
  const n = pl.points.length / 2;
  if (n < 2) return out;

  if (want.start && !fromClosed) {
    const seat = seated(pl, insets.start ?? 0, 'start');
    if (seat) {
      // Reversed, so a start head points away from the line body the way an
      // end head does. SVG spells this `auto-start-reverse`; here it is the
      // only behavior.
      out.push({ x: seat.x, y: seat.y, angle: Math.atan2(seat.dy, seat.dx), role: 'start' });
    } else {
      const j = nextDistinct(pl, 0, n);
      const d = j >= 0 ? dir(pl, 0, j)! : X_AXIS;
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

  if (want.end && !fromClosed) {
    const seat = seated(pl, insets.end ?? 0, 'end');
    if (seat) {
      out.push({ x: seat.x, y: seat.y, angle: Math.atan2(seat.dy, seat.dx), role: 'end' });
    } else {
      const last = n - 1;
      const p = prevDistinct(pl, last);
      const d = p >= 0 ? dir(pl, p, last)! : X_AXIS;
      out.push({ x: pl.points[last * 2], y: pl.points[last * 2 + 1], angle: Math.atan2(d.y, d.x), role: 'end' });
    }
  }

  return out;
}

/** Where a head the line stops `inset` short of at `end` goes, and the outward
 *  direction it points: `inset` on from the shortened line's end, along the
 *  line's last direction there. `null` with no inset, or when the inset eats
 *  the whole line. */
function seated(pl: Polyline, inset: number, end: 'start' | 'end'): { x: number; y: number; dx: number; dy: number } | null {
  if (!(inset > 0)) return null;
  const cut = trimPolyline(pl, end === 'start' ? inset : 0, end === 'end' ? inset : 0);
  if (cut === null || cut === pl) return null;
  const m = cut.points.length / 2;
  if (end === 'end') {
    const p = prevDistinct(cut, m - 1);
    const d = p >= 0 ? dir(cut, p, m - 1) : null;
    if (!d) return null;
    return { x: cut.points[(m - 1) * 2] + d.x * inset, y: cut.points[(m - 1) * 2 + 1] + d.y * inset, dx: d.x, dy: d.y };
  }
  const j = nextDistinct(cut, 0, m);
  const d = j >= 0 ? dir(cut, 0, j) : null;
  if (!d) return null;
  return { x: cut.points[0] - d.x * inset, y: cut.points[1] - d.y * inset, dx: -d.x, dy: -d.y };
}
