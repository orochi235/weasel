/**
 * A path's flattened rings, resolved by its fill rule where they meet. Nesting
 * rings by containment reads them right only while each lies wholly inside or
 * outside every other; rings that cross or touch are cut against one another
 * and every piece kept by the winding on its two sides, as `curveBoolean` does.
 */
import type { PathFillRule } from '../path';
import type { Contour } from './contourSegments';
import { cutContours, curveRegions } from './curveBoolean';
import { clipper } from './clipper';
import type { Ring } from './adapter';

/** Whether two edges of `rings` meet anywhere, other than neighbors of one ring at their shared vertex. */
export function ringsMeet(rings: readonly Ring[]): boolean {
  type E = { x0: number; y0: number; x1: number; y1: number; lo: number; hi: number; ring: number; k: number; n: number };
  const edges: E[] = [];
  rings.forEach((given, ring) => {
    const pts = given.filter((p, i) => i === 0 || p[0] !== given[i - 1][0] || p[1] !== given[i - 1][1]);
    const n = pts.length - 1;
    for (let k = 0; k < n; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      edges.push({ x0, y0, x1, y1, lo: Math.min(y0, y1), hi: Math.max(y0, y1), ring, k, n });
    }
  });
  const left = (e: E) => Math.min(e.x0, e.x1);
  edges.sort((a, b) => left(a) - left(b));
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const right = Math.max(e.x0, e.x1);
    for (let j = i + 1; j < edges.length; j++) {
      const f = edges[j];
      if (left(f) > right) break;
      if (f.hi < e.lo || f.lo > e.hi) continue;
      if (e.ring === f.ring) {
        const d = Math.abs(e.k - f.k);
        if (d === 1 || d === e.n - 1) continue;
      }
      if (segmentsMeet(e, f)) return true;
    }
  }
  return false;
}

const side = (ax: number, ay: number, bx: number, by: number, px: number, py: number): number =>
  Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));

/** Whether two segments share a point, touching or overlapping included. */
function segmentsMeet(e: { x0: number; y0: number; x1: number; y1: number }, f: typeof e): boolean {
  const d1 = side(f.x0, f.y0, f.x1, f.y1, e.x0, e.y0), d2 = side(f.x0, f.y0, f.x1, f.y1, e.x1, e.y1);
  const d3 = side(e.x0, e.y0, e.x1, e.y1, f.x0, f.y0), d4 = side(e.x0, e.y0, e.x1, e.y1, f.x1, f.y1);
  if (d1 === 0 && d2 === 0) {
    // Collinear: the boxes overlap on both axes, so the segments share a point.
    return Math.max(Math.min(e.x0, e.x1), Math.min(f.x0, f.x1)) <= Math.min(Math.max(e.x0, e.x1), Math.max(f.x0, f.x1))
      && Math.max(Math.min(e.y0, e.y1), Math.min(f.y0, f.y1)) <= Math.min(Math.max(e.y0, e.y1), Math.max(f.y0, f.y1));
  }
  return d1 * d2 <= 0 && d3 * d4 <= 0;
}

/**
 * The fill of `rings` under `fillRule` as rings that do not cross, filled on
 * their left, or null where nesting by containment already reads them right.
 * Where the cut cannot be made, an even-odd fill falls back to the rings'
 * exclusive or, and a nonzero one to null.
 */
export function resolveRingFill(rings: readonly Ring[], fillRule: PathFillRule): Ring[] | null {
  if (rings.length < (fillRule === 'evenodd' ? 1 : 2) || !ringsMeet(rings)) return null;
  const contour = (ring: Ring): Contour => ring.slice(0, -1).map(([x, y], i) => {
    const [nx, ny] = ring[i + 1];
    return [{ x, y }, { x: nx, y: ny }];
  }).filter(([a, b]) => a.x !== b.x || a.y !== b.y);
  const cut = cutContours([rings.map(contour).filter((c) => c.length > 0)], [fillRule]);
  const regions = cut && curveRegions(cut, (inside) => (inside[0] ? 0 : -1));
  if (regions) {
    return (regions.get(0) ?? []).map((loop) => {
      const ring: Ring = loop.map((s) => [s[0].x, s[0].y]);
      ring.push([loop[0][0].x, loop[0][0].y]);
      return ring;
    });
  }
  if (fillRule !== 'evenodd') return null;
  const [head, ...rest] = rings.map((ring) => [[ring]]);
  return clipper.xor(head, ...rest).flat();
}
