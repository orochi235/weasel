/** Outlines that run along each other: where a shared stretch starts and ends, and its pieces made one edge. */

import type { Point } from '../paths/cubicMath';
import { nearestOnCubic, nearestOnLine, nearestOnQuadratic, type CurveNearest } from '../nearest';
import { type Seg, evalSeg } from './contourSegments';
import type { Edge } from './curveEdges';

/** The point on `s` nearest `p`. */
export function nearestOnSeg(s: Seg, p: Point): CurveNearest {
  if (s.length === 2) return nearestOnLine(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y);
  if (s.length === 3) return nearestOnQuadratic(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y);
  return nearestOnCubic(p.x, p.y, s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y, s[3].x, s[3].y);
}

/** One end of a stretch two segments share: the parameter on each, and the point. */
export interface OverlapEnd {
  ta: number;
  tb: number;
  p: Point;
}

/** Interior samples a stretch must lie on the other segment at to count as shared. */
const SAMPLES = [0.25, 0.5, 0.75];

/**
 * The ends of the stretch `a` and `b` share, or null when they share none.
 * Each end of a shared stretch is an end of one segment lying on the other,
 * so only those are tried: two segments of degree three or less that share a
 * stretch are pieces of one curve and cross nowhere else.
 */
export function sharedStretch(a: Seg, b: Seg, snap: number): [OverlapEnd, OverlapEnd] | null {
  const ends: OverlapEnd[] = [];
  const add = (e: OverlapEnd) => {
    if (!ends.some((f) => Math.hypot(f.p.x - e.p.x, f.p.y - e.p.y) <= snap)) ends.push(e);
  };
  for (const [tb, p] of [[0, b[0]], [1, b[b.length - 1]]] as const) {
    const n = nearestOnSeg(a, p);
    if (n.dist <= snap) add({ ta: n.t, tb, p });
  }
  for (const [ta, p] of [[0, a[0]], [1, a[a.length - 1]]] as const) {
    const n = nearestOnSeg(b, p);
    if (n.dist <= snap) add({ ta, tb: n.t, p });
  }
  let best: [OverlapEnd, OverlapEnd] | null = null;
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const [e, f] = ends[i].ta <= ends[j].ta ? [ends[i], ends[j]] : [ends[j], ends[i]];
      if (best && f.ta - e.ta <= best[1].ta - best[0].ta) continue;
      const on = SAMPLES.every((s) => nearestOnSeg(b, evalSeg(a, e.ta + (f.ta - e.ta) * s)).dist <= snap);
      if (on) best = [e, f];
    }
  }
  return best;
}

/** Whether `e` and `f` join the same two vertices along the same curve. */
function coincide(e: Edge, f: Edge, snap: number): boolean {
  const same = e.from === f.from && e.to === f.to;
  if (!same && !(e.from === f.to && e.to === f.from)) return false;
  return SAMPLES.every((s) => nearestOnSeg(f.seg, evalSeg(e.seg, s)).dist <= snap);
}

/**
 * `edges` with every set of pieces lying along one another made one edge,
 * the first of them, naming the others in `also`.
 */
export function mergeCoincident(edges: readonly Edge[], snap: number): Edge[] {
  const byEnds = new Map<string, Edge[]>();
  const out: Edge[] = [];
  for (const e of edges) {
    const key = e.from < e.to ? `${e.from},${e.to}` : `${e.to},${e.from}`;
    const list = byEnds.get(key) ?? [];
    const twin = list.find((f) => coincide(f, e, snap));
    if (twin) {
      (twin.also ??= []).push({ operand: e.operand, sign: twin.from === e.from ? 1 : -1 });
      continue;
    }
    list.push(e);
    byEnds.set(key, list);
    out.push(e);
  }
  return out;
}
