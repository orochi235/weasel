/** Where a cut crosses the contours of a path. */

import type { Point } from '../paths/cubicMath';
import { type Contour, type Station, evalSeg, sideCoeffs, signChanges, endSide } from './contourSegments';

export interface Crossing extends Station {
  contour: number;
  /** Position along the cut: cut segment k runs from k to k + 1. */
  s: number;
  /** True where the cut, going forward, enters the filled region. */
  enters: boolean;
}

/**
 * Where along cut segment `k` of `cut` a point on its line falls, as a
 * position on the whole cut, or null when it is off that segment. A point at a
 * joint belongs to the segment that starts there, so it is counted once.
 */
export function cutPosition(cut: Point[], k: number, pt: Point): number | null {
  const a = cut[k], b = cut[k + 1];
  const d = { x: b.x - a.x, y: b.y - a.y };
  const s = ((pt.x - a.x) * d.x + (pt.y - a.y) * d.y) / (d.x * d.x + d.y * d.y);
  const eps = 1e-9;
  const last = k + 2 === cut.length;
  if (s < (k === 0 ? 0 : -eps)) return null;
  if (last ? s > 1 : s >= 1 - eps) return null;
  return k + Math.min(1, Math.max(0, s));
}

/** Every point where the boundary crosses the cut, sorted along it. */
export function findCrossings(boundaries: Contour[], cut: Point[]): Crossing[] {
  const out: Crossing[] = [];
  for (let k = 0; k + 1 < cut.length; k++) crossingsOnSegment(boundaries, cut, k, out);
  return out.sort((x, y) => x.s - y.s);
}

function crossingsOnSegment(boundaries: Contour[], cut: Point[], k: number, out: Crossing[]): void {
  const a = cut[k];
  const d = { x: cut[k + 1].x - a.x, y: cut[k + 1].y - a.y };
  const push = (contour: number, seg: number, t: number, before: number, after: number) => {
    const pt = evalSeg(boundaries[contour][seg], t);
    const s = cutPosition(cut, k, pt);
    if (s === null) return;
    // Fill is on the boundary's left: crossing from the cut's left to its right is an entry.
    out.push({ contour, seg, t, pt, s, enters: before > 0 && after < 0 });
  };

  boundaries.forEach((contour, ci) => {
    const fs = contour.map((s) => sideCoeffs(s, a, d));
    const n = contour.length;
    fs.forEach((f, si) => {
      for (const c of signChanges(f, false)) push(ci, si, c.t, c.before, c.after);
      if (f[0] !== 0) return;
      // The segment passes through this vertex. Where the boundary runs along
      // the cut, the crossing is taken at the end of the run.
      const after = endSide(f, true);
      if (after === 0) return;
      let before = 0;
      for (let k = 1; k <= n && before === 0; k++) before = endSide(fs[(si - k + n) % n], false);
      if (before !== 0 && before !== after) push(ci, si, 0, before, after);
    });
  });
}
