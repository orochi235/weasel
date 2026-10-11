/** Tracing the loops a cut divides a path's contours into. */

import type { Point } from '../paths/cubicMath';
import { type Seg, type Contour, type Station, subSeg } from './contourSegments';
import type { Crossing } from './cutCrossings';

/**
 * Walk the boundary arcs between cut points and the chords that join them.
 * With the fill on every contour's left, each arc ending at a cut point
 * continues along that point's chord and then along the arc leaving the
 * chord's other end.
 */
export function traceLoops(
  boundaries: Contour[],
  partner: Map<Crossing, Crossing>,
  chord: Map<Crossing, Point[]>,
): { loops: Contour[]; untouched: Contour[] } {
  const byContour = new Map<number, Crossing[]>();
  for (const c of partner.keys()) {
    const list = byContour.get(c.contour) ?? [];
    list.push(c);
    byContour.set(c.contour, list);
  }

  const arcFrom = new Map<Crossing, { segs: Seg[]; end: Crossing }>();
  const untouched: Contour[] = [];
  boundaries.forEach((contour, ci) => {
    const cuts = byContour.get(ci);
    if (!cuts) { untouched.push(contour); return; }
    cuts.sort((x, y) => x.seg - y.seg || x.t - y.t);
    for (let k = 0; k < cuts.length; k++) {
      const from = cuts[k], to = cuts[(k + 1) % cuts.length];
      arcFrom.set(from, { segs: arcBetween(contour, from, to, cuts.length === 1), end: to });
    }
  });

  const loops: Contour[] = [];
  const seen = new Set<Crossing>();
  for (const start of arcFrom.keys()) {
    if (seen.has(start)) continue;
    const loop: Contour = [];
    let at = start;
    while (!seen.has(at)) {
      seen.add(at);
      const arc = arcFrom.get(at)!;
      loop.push(...arc.segs);
      const run = chord.get(arc.end)!;
      for (let i = 0; i + 1 < run.length; i++) loop.push([run[i], run[i + 1]]);
      at = partner.get(arc.end)!;
    }
    loops.push(loop);
  }
  return { loops, untouched };
}

/** The boundary from one cut point forward to the next. */
export function arcBetween(contour: Contour, from: Station, to: Station, whole: boolean): Seg[] {
  const out: Seg[] = [];
  const add = (s: Seg | null) => { if (s) out.push(s); };
  if (!whole && to.seg === from.seg && to.t > from.t) {
    add(subSeg(contour[from.seg], from.t, to.t, from.pt, to.pt));
    return out;
  }
  const n = contour.length;
  const first = contour[from.seg];
  add(subSeg(first, from.t, 1, from.pt, first[first.length - 1]));
  for (let i = (from.seg + 1) % n; i !== to.seg; i = (i + 1) % n) out.push(contour[i]);
  const last = contour[to.seg];
  add(subSeg(last, 0, to.t, last[0], to.pt));
  return out;
}
