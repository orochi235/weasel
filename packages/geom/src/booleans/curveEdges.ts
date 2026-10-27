/** The operands' outlines cut at every crossing into edges that meet only at their ends. */

import type { Point } from '../paths/cubicMath';
import { intersectSegments } from '../intersect/segmentIntersections';
import { type Seg, type Contour, evalSeg, subSeg } from './contourSegments';
import { mergeCoincident, sharedStretch } from './curveOverlap';

/** One piece of an outline between two crossings, and where it came from. */
export interface Edge {
  seg: Seg;
  /** Vertex ids of its ends. */
  from: number;
  to: number;
  operand: number;
  /** The whole segment it was cut from, and the parameters it spans on it. */
  source: Seg;
  t0: number;
  t1: number;
  /** Orders edges by where they sit in the input. */
  key: number;
  /** Runs against its source curve. */
  reversed: boolean;
  /** Other operands' pieces lying along this one, each running with it (1) or against it (-1). */
  also?: { operand: number; sign: 1 | -1 }[];
}

export interface Arrangement {
  edges: Edge[];
  points: Point[];
}

/** Two curves overlapping along a stretch report at most this many crossings. */
const OVERLAP_HITS = 16;
const END_T = 1e-9;

/** Points within `snap` of each other are one vertex. */
class Vertices {
  readonly points: Point[] = [];
  private readonly grid = new Map<string, number[]>();
  constructor(private readonly snap: number) {}

  id(p: Point): number {
    const gx = Math.floor(p.x / this.snap), gy = Math.floor(p.y / this.snap);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const i of this.grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          const q = this.points[i];
          if (Math.hypot(q.x - p.x, q.y - p.y) <= this.snap) return i;
        }
      }
    }
    const i = this.points.length;
    this.points.push({ x: p.x, y: p.y });
    const key = `${gx},${gy}`;
    const cell = this.grid.get(key);
    if (cell) cell.push(i); else this.grid.set(key, [i]);
    return i;
  }
}

interface SegRef {
  seg: Seg;
  operand: number;
  contour: number;
  index: number;
  count: number;
  box: [number, number, number, number];
}

function refsOf(operands: readonly Contour[][]): SegRef[] {
  const out: SegRef[] = [];
  operands.forEach((contours, operand) => contours.forEach((c, contour) => c.forEach((seg, index) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of seg) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    out.push({ seg, operand, contour, index, count: c.length, box: [x0, y0, x1, y1] });
  })));
  return out;
}

const adjacent = (a: SegRef, b: SegRef): boolean => {
  if (a.operand !== b.operand || a.contour !== b.contour) return false;
  const d = Math.abs(a.index - b.index);
  return d === 1 || d === a.count - 1;
};

/** Whether a cubic crosses itself, which no pair of segments would find. */
function loops(seg: Seg): boolean {
  if (seg.length < 4) return false;
  const mid = evalSeg(seg, 0.5);
  const l = subSeg(seg, 0, 0.5, seg[0], mid);
  const r = subSeg(seg, 0.5, 1, mid, seg[3]);
  if (!l || !r) return false;
  return intersectSegments(l, r).some((h) => h.ta < 1 - 1e-6 || h.tb > 1e-6);
}

/**
 * Every segment of every operand cut where any other crosses or touches it,
 * or starts or stops running along it, the cut ends snapped to shared
 * vertices; pieces that lie along each other are one edge. Null when the
 * input has a case the cut cannot represent: a cubic that crosses itself, or
 * an overlap whose ends are not ends of either segment.
 */
export function cutEdges(operands: readonly Contour[][], snap: number): Arrangement | null {
  const refs = refsOf(operands);
  if (refs.some((r) => loops(r.seg))) return null;
  const verts = new Vertices(snap);
  // Ends first, so a crossing that lands on one takes its exact position rather than giving it a computed one.
  const ends = refs.map(({ seg }) => [verts.id(seg[0]), verts.id(seg[seg.length - 1])]);
  const stops: { t: number; v: number }[][] = refs.map(() => []);

  for (let i = 0; i < refs.length; i++) {
    const a = refs[i];
    for (let j = i + 1; j < refs.length; j++) {
      const b = refs[j];
      if (a.box[0] > b.box[2] + snap || b.box[0] > a.box[2] + snap
        || a.box[1] > b.box[3] + snap || b.box[1] > a.box[3] + snap) continue;
      const shared = sharedStretch(a.seg, b.seg, snap);
      if (shared) {
        for (const end of shared) {
          const v = verts.id(end.p);
          stops[i].push({ t: end.ta, v });
          stops[j].push({ t: end.tb, v });
        }
        continue;
      }
      const hits = intersectSegments(a.seg, b.seg);
      if (hits.length >= OVERLAP_HITS) return null;
      const near = adjacent(a, b);
      for (const h of hits) {
        if (near && ((h.ta > 1 - END_T && h.tb < END_T) || (h.ta < END_T && h.tb > 1 - END_T))) continue;
        const v = verts.id(h);
        stops[i].push({ t: h.ta, v });
        stops[j].push({ t: h.tb, v });
      }
    }
  }

  const edges: Edge[] = [];
  refs.forEach((ref, i) => {
    const { seg } = ref;
    const list = [{ t: 0, v: ends[i][0] }, ...stops[i].sort((p, q) => p.t - q.t), { t: 1, v: ends[i][1] }];
    // The same vertex twice in a row is one stop, the segment's own end kept over a crossing.
    const kept = [list[0]];
    for (let k = 1; k < list.length; k++) {
      const s = list[k];
      if (s.v !== kept[kept.length - 1].v) kept.push(s);
      else if (k === list.length - 1 && kept.length > 1) kept[kept.length - 1] = s;
    }
    // A segment that leaves a vertex and comes back to it with no stop between is a loop of its own.
    const size = Math.hypot(ref.box[2] - ref.box[0], ref.box[3] - ref.box[1]);
    if (kept.length === 1 && seg.length > 2 && size > 100 * snap) kept.push(list[list.length - 1]);
    for (let k = 0; k + 1 < kept.length; k++) {
      const a = kept[k], b = kept[k + 1];
      const piece = a.t === 0 && b.t === 1 ? seg.slice() : subSeg(seg, a.t, b.t, verts.points[a.v], verts.points[b.v]);
      if (!piece) continue;
      piece[0] = verts.points[a.v];
      piece[piece.length - 1] = verts.points[b.v];
      edges.push({ seg: piece, from: a.v, to: b.v, operand: ref.operand, source: seg, t0: a.t, t1: b.t, key: i + a.t * 0.5, reversed: false });
    }
  });
  return { edges: mergeCoincident(edges, snap), points: verts.points };
}
