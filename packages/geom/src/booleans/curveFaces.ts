/**
 * The faces paths' outlines cut the plane into, with curves kept: the
 * arrangement is cut and traced on a fine flattening, so its topology is that
 * of straight lines, and each face's boundary is written back as pieces of
 * the input curves running between the flattening's crossings.
 */

import type { Path, PathFillRule } from '../path';
import { type Contour, type Seg, evalSeg, signedArea, subSeg } from './contourSegments';
import { parseContours, extentOf } from './contours';
import { type Along, type LineSeg, arrangeLines, linkFaces } from './arrangement';
import { type Cycles, type Linked, cyclesOf, cycleWindings, leftmost } from './faceCycles';
import { type Polish, type PolishStats, polishCrossings } from './crossingPolish';

/** Two faces whose boundaries share `length` of edge; `a` is -1 for the uncovered side, else `a < b`. */
export interface FaceNeighbor {
  a: number;
  b: number;
  length: number;
}

export interface CurveFace {
  /** The outer loop, then the holes, each with the face on its left. */
  loops: Contour[];
  /** The inputs covering it, ascending. */
  sources: number[];
}

export interface CurveFaceSet {
  faces: CurveFace[];
  neighbors: FaceNeighbor[];
  /** Per input, whether its largest contour turns with its fill on the right. */
  clockwise: boolean[];
  polish: PolishStats;
}

/** The flattening the arrangement is cut from: each chord, the input segment it lies along, and its parameters there. */
interface Flat {
  lines: LineSeg[];
  segs: Seg[];
  operand: number[];
  seg: Int32Array;
  t0: Float64Array;
  t1: Float64Array;
}

/** How many chords keep a Bézier within `tol` of its flattening: degree·(degree − 1)/8 of its largest second difference over n². */
function chords(s: Seg, tol: number): number {
  if (s.length === 2) return 1;
  let m = 0;
  for (let i = 0; i + 2 < s.length; i++) {
    m = Math.max(m, Math.hypot(s[i + 2].x - 2 * s[i + 1].x + s[i].x, s[i + 2].y - 2 * s[i + 1].y + s[i].y));
  }
  const d = s.length - 1;
  return Math.min(1024, Math.max(1, Math.ceil(Math.sqrt((d * (d - 1) * m) / (8 * tol)))));
}

function flatten(operands: readonly Contour[][], tol: number): Flat {
  const lines: LineSeg[] = [], segs: Seg[] = [], operand: number[] = [];
  const seg: number[] = [], t0: number[] = [], t1: number[] = [];
  operands.forEach((contours, k) => {
    for (const s of contours.flat()) {
      const id = segs.length;
      segs.push(s);
      operand.push(k);
      const n = chords(s, tol);
      let p = s[0];
      for (let i = 1; i <= n; i++) {
        const q = i === n ? s[s.length - 1] : evalSeg(s, i / n);
        lines.push({ ax: p.x, ay: p.y, bx: q.x, by: q.y });
        seg.push(id);
        t0.push((i - 1) / n);
        t1.push(i / n);
        p = q;
      }
    }
  });
  return { lines, segs, operand, seg: Int32Array.from(seg), t0: Float64Array.from(t0), t1: Float64Array.from(t1) };
}

/** Per edge, `[input, count]` pairs: how many times each input's outline runs along it, start to end. */
function runsOf(along: readonly Along[][], flat: Flat): number[][] {
  return along.map((list) => {
    const out: number[] = [];
    for (const a of list) {
      const k = flat.operand[flat.seg[a.seg]];
      const d = a.s0 < a.s1 ? 1 : -1;
      let i = 0;
      while (i < out.length && out[i] !== k) i += 2;
      if (i < out.length) out[i + 1] += d; else out.push(k, d);
    }
    return out;
  });
}

const filled = (w: number, rule: PathFillRule): boolean => (rule === 'evenodd' ? (w & 1) !== 0 : w !== 0);

/** Each cycle's cover as a sorted list of inputs, keyed by those lists joined. */
function coverKeys(winding: Int16Array, rules: readonly PathFillRule[], cycles: number): string[] {
  const n = rules.length;
  const out: string[] = [];
  for (let c = 0; c < cycles; c++) {
    const s: number[] = [];
    for (let k = 0; k < n; k++) if (filled(winding[c * n + k], rules[k])) s.push(k);
    out.push(s.join(','));
  }
  return out;
}

interface Kept extends Linked {
  along: Along[][];
  /** Per half-edge, the cover key of the face on its left. */
  key: string[];
}

/** The arrangement less the edges whose two sides have the same cover, which bound nothing. */
function bounding(a: Linked & { along: Along[][] }, c: Cycles, keys: readonly string[]): Kept {
  const origin: number[] = [], along: Along[][] = [], key: string[] = [];
  for (let e = 0; e < a.along.length; e++) {
    const l = keys[c.cycleOf[2 * e]], r = keys[c.cycleOf[2 * e + 1]];
    if (l === r) continue;
    origin.push(a.origin[2 * e], a.origin[2 * e + 1]);
    along.push(a.along[e]);
    key.push(l, r);
  }
  return { xs: a.xs, ys: a.ys, origin, next: linkFaces(a.xs, a.ys, origin), along, key };
}

function ringHolds(a: Linked, cycle: readonly number[], px: number, py: number): boolean {
  let inside = false;
  for (const h of cycle) {
    const x0 = a.xs[a.origin[h]], y0 = a.ys[a.origin[h]];
    const x1 = a.xs[a.origin[h ^ 1]], y1 = a.ys[a.origin[h ^ 1]];
    if ((y0 > py) !== (y1 > py) && px < x0 + ((py - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
  }
  return inside;
}

/** Per piece, the smallest bounded cycle of another piece holding it, or -1. */
function hosts(a: Linked, c: Cycles, minArea: number): Map<number, number> {
  const boxes = c.cycles.map((cycle) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const h of cycle) {
      const v = a.origin[h];
      x0 = Math.min(x0, a.xs[v]); x1 = Math.max(x1, a.xs[v]);
      y0 = Math.min(y0, a.ys[v]); y1 = Math.max(y1, a.ys[v]);
    }
    return [x0, y0, x1, y1];
  });
  const out = new Map<number, number>();
  for (const [piece, outside] of c.outside) {
    const v = leftmost(a, c.cycles[outside]);
    const px = a.xs[v], py = a.ys[v];
    let host = -1;
    c.cycles.forEach((cycle, i) => {
      if (c.piece[i] === piece || c.area[i] <= minArea) return;
      const b = boxes[i];
      if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) return;
      if (host !== -1 && c.area[host] <= c.area[i]) return;
      if (ringHolds(a, cycle, px, py)) host = i;
    });
    out.set(piece, host);
  }
  return out;
}

/** A cycle as curve segments: each run of edges along one input segment written as one piece of it. */
function loopOf(a: Kept, flat: Flat, polish: Polish, cycle: readonly number[]): Contour {
  const n = flat.segs.length;
  const parts = cycle.map((h) => {
    const al = a.along[h >> 1][0];
    const [s0, s1] = h & 1 ? [al.s1, al.s0] : [al.s0, al.s1];
    const t0 = flat.t0[al.seg], dt = flat.t1[al.seg] - t0;
    const seg = flat.seg[al.seg], from = a.origin[h], to = a.origin[h ^ 1];
    const ta = polish.t.get(from * n + seg) ?? t0 + s0 * dt, tb = polish.t.get(to * n + seg) ?? t0 + s1 * dt;
    return { seg, ta, tb, from, to };
  });
  const at = (v: number) => polish.at.get(v) ?? { x: a.xs[v], y: a.ys[v] };
  const joins = (p: (typeof parts)[number], q: (typeof parts)[number]) =>
    p.seg === q.seg && p.tb === q.ta && (p.tb > p.ta) === (q.tb > q.ta);
  let start = parts.findIndex((p, i) => !joins(parts[(i - 1 + parts.length) % parts.length], p));
  if (start < 0) start = 0;
  const out: Contour = [];
  for (let i = 0; i < parts.length;) {
    const first = parts[(start + i) % parts.length];
    let last = first;
    for (i++; i < parts.length && joins(last, parts[(start + i) % parts.length]); i++) last = parts[(start + i) % parts.length];
    const src = flat.segs[first.seg];
    const p = at(first.from), q = at(last.to);
    if (src.length === 2) { out.push([p, q]); continue; }
    const forward = last.tb > first.ta;
    const piece = forward ? subSeg(src, first.ta, last.tb, p, q) : subSeg(src, last.tb, first.ta, q, p);
    if (piece) out.push(forward ? piece : piece.reverse());
  }
  return out;
}

/** Whether a contour set's largest contour turns with its fill on the right. */
function clockwiseFirst(contours: readonly Contour[]): boolean {
  let best = 0;
  for (const c of contours) {
    const a = signedArea(c);
    if (Math.abs(a) > Math.abs(best)) best = a;
  }
  return best < 0;
}

const maskOf = (sources: readonly number[]): bigint => sources.reduce((m, i) => m | (1n << BigInt(i)), 0n);

/**
 * The faces `paths` cut the plane into that some path covers, each one
 * connected region with its holes, and which faces share edges. The
 * arrangement is cut from a flattening within `tolerance` of every curve;
 * each face's boundary is written as pieces of the input curves, their ends
 * where the flattening crosses, moved onto the curves' own crossing where
 * `polishCrossings` can do so safely (`polish`, on by default). Faces come
 * fewest covering inputs first, then by which, then left to right.
 */
export function curveFaces(paths: readonly Path[], tolerance?: number, polish = true): CurveFaceSet {
  const operands = paths.map((p) => parseContours(p));
  const clockwise = operands.map(clockwiseFirst);
  const extent = extentOf(operands.flat()) || 1;
  const tol = tolerance ?? extent * 1e-5;
  const flat = flatten(operands, tol);
  const arr = arrangeLines(flat.lines);
  const rules = paths.map((p): PathFillRule => (p.kind === 'polygon' ? p.fillRule : 'nonzero'));
  const first = cyclesOf(arr);
  const winding = cycleWindings(arr, first, runsOf(arr.along, flat), paths.length);
  const kept = bounding(arr, first, coverKeys(winding, rules, first.cycles.length));
  const c = cyclesOf(kept);
  const minArea = 1e-12 * extent * extent;
  const host = hosts(kept, c, minArea);
  const outsides = new Set(c.outside.values());
  const moved = polish ? polishCrossings(kept, flat, tol, extent)
    : { at: new Map(), t: new Map(), stats: { crossings: 0, polished: 0, largestMove: 0 } };

  const faceOf = new Int32Array(c.cycles.length).fill(-1);
  const found: { face: CurveFace; mask: bigint; at: [number, number]; cycle: number }[] = [];
  c.cycles.forEach((cycle, i) => {
    const key = kept.key[cycle[0]];
    if (outsides.has(i) || c.area[i] <= minArea || key === '') return;
    faceOf[i] = found.length;
    const sources = key.split(',').map(Number);
    const v = leftmost(kept, cycle);
    found.push({ face: { loops: [loopOf(kept, flat, moved, cycle)], sources }, mask: maskOf(sources), at: [kept.xs[v], kept.ys[v]], cycle: i });
  });
  for (const [piece, outside] of c.outside) {
    const h = host.get(piece)!;
    const f = h < 0 ? -1 : faceOf[h];
    faceOf[outside] = f;
    if (f >= 0) found[f].face.loops.push(loopOf(kept, flat, moved, c.cycles[outside]));
  }

  const order = found.map((_, i) => i).sort((i, j) => {
    const a = found[i], b = found[j];
    return a.face.sources.length - b.face.sources.length
      || (a.mask < b.mask ? -1 : a.mask > b.mask ? 1 : 0)
      || a.at[0] - b.at[0] || a.at[1] - b.at[1];
  });
  const rank = new Int32Array(found.length);
  order.forEach((f, r) => { rank[f] = r; });
  return { faces: order.map((f) => found[f].face), neighbors: neighborsOf(kept, c, faceOf, rank), clockwise, polish: moved.stats };
}

/** Each pair of faces sharing edges, and the length they share. */
function neighborsOf(a: Kept, c: Cycles, faceOf: Int32Array, rank: Int32Array): FaceNeighbor[] {
  const shared = new Map<number, FaceNeighbor>();
  const n = rank.length + 1;
  for (let e = 0; 2 * e < a.origin.length; e++) {
    const l = faceOf[c.cycleOf[2 * e]], r = faceOf[c.cycleOf[2 * e + 1]];
    if (l === r) continue;
    const x = l < 0 ? -1 : rank[l], y = r < 0 ? -1 : rank[r];
    const [lo, hi] = x < y ? [x, y] : [y, x];
    const u = a.origin[2 * e], v = a.origin[2 * e + 1];
    const len = Math.hypot(a.xs[v] - a.xs[u], a.ys[v] - a.ys[u]);
    const k = (lo + 1) * n + hi;
    const entry = shared.get(k);
    if (entry) entry.length += len; else shared.set(k, { a: lo, b: hi, length: len });
  }
  return [...shared.values()].sort((p, q) => p.a - q.a || p.b - q.b);
}
