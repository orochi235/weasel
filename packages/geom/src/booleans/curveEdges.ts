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

/** Two curves that run nearly along each other cross many times: past the first few, collect up to this many. */
const FIRST_HITS = 16;
const NEAR_HITS = 256;
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

/** Where a cubic crosses itself, as its two parameters there, or null when it does not. */
function selfCrossing(seg: Seg): [number, number] | null {
  if (seg.length < 4) return null;
  const mid = evalSeg(seg, 0.5);
  const l = subSeg(seg, 0, 0.5, seg[0], mid);
  const r = subSeg(seg, 0.5, 1, mid, seg[3]);
  if (!l || !r) return null;
  const h = intersectSegments(l, r).find((c) => c.ta < 1 - 1e-6 || c.tb > 1e-6);
  return h ? [h.ta / 2, 0.5 + h.tb / 2] : null;
}

/**
 * `seg`, or a cubic that crosses itself cut where it does and halfway round
 * its loop, so no piece crosses itself and the crossing is a shared end.
 */
function unlooped(seg: Seg): Seg[] {
  const ts = selfCrossing(seg);
  if (!ts) return [seg];
  const [t1, t2] = ts;
  const a = evalSeg(seg, t1), b = evalSeg(seg, t2);
  const x = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m = evalSeg(seg, (t1 + t2) / 2);
  const stops = [{ t: 0, p: seg[0] }, { t: t1, p: x }, { t: (t1 + t2) / 2, p: m }, { t: t2, p: x }, { t: 1, p: seg[3] }];
  const out: Seg[] = [];
  for (let k = 0; k + 1 < stops.length; k++) {
    const piece = subSeg(seg, stops[k].t, stops[k + 1].t, stops[k].p, stops[k + 1].p);
    if (piece) out.push(piece);
  }
  return out;
}

/** Each pair of `refs` whose boxes come within `snap`, found by a sweep in x. */
function nearPairs(refs: readonly SegRef[], snap: number, visit: (i: number, j: number) => void): void {
  const order = refs.map((_, i) => i).sort((i, j) => refs[i].box[0] - refs[j].box[0]);
  for (let p = 0; p < order.length; p++) {
    const i = order[p], a = refs[i].box;
    for (let q = p + 1; q < order.length; q++) {
      const j = order[q], b = refs[j].box;
      if (b[0] > a[2] + snap) break;
      if (a[1] > b[3] + snap || b[1] > a[3] + snap) continue;
      visit(Math.min(i, j), Math.max(i, j));
    }
  }
}

/**
 * Every segment of every operand cut where any other crosses or touches it,
 * or starts or stops running along it, the cut ends snapped to shared
 * vertices; pieces that lie along each other are one edge. A cubic that
 * crosses itself is cut there first.
 */
export function cutEdges(given: readonly Contour[][], snap: number): Arrangement {
  const refs = refsOf(given.map((cs) => cs.map((c) => c.flatMap(unlooped))));
  const verts = new Vertices(snap);
  // Ends first, so a crossing that lands on one takes its exact position rather than giving it a computed one.
  const ends = refs.map(({ seg }) => [verts.id(seg[0]), verts.id(seg[seg.length - 1])]);
  const stops: { t: number; v: number }[][] = refs.map(() => []);

  nearPairs(refs, snap, (i, j) => {
    const a = refs[i], b = refs[j];
    const shared = sharedStretch(a.seg, b.seg, snap);
    if (shared) {
      for (const end of shared) {
        const v = verts.id(end.p);
        stops[i].push({ t: end.ta, v });
        stops[j].push({ t: end.tb, v });
      }
      return;
    }
    let hits = intersectSegments(a.seg, b.seg, FIRST_HITS);
    if (hits.length >= FIRST_HITS) hits = intersectSegments(a.seg, b.seg, NEAR_HITS);
    const near = adjacent(a, b);
    for (const h of hits) {
      if (near && ((h.ta > 1 - END_T && h.tb < END_T) || (h.ta < END_T && h.tb > 1 - END_T))) continue;
      const v = verts.id(h);
      stops[i].push({ t: h.ta, v });
      stops[j].push({ t: h.tb, v });
    }
  });

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
