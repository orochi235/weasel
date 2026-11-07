/**
 * Moving the crossings of a flattened arrangement onto the curves it was cut
 * from: where exactly two input segments cross at a vertex, Newton's method on
 * their parameters finds where the curves themselves cross. Only the points
 * written out move; the arrangement and its faces stay as the flattening cut
 * them, so a polish that could disturb them is not made.
 */

import type { Point } from '../paths/cubicMath';
import { type Seg, evalSeg, derivSeg } from './contourSegments';
import type { Along } from './arrangement';

/** The flattening an arrangement was cut from: each chord's input segment and its parameters there. */
export interface Chords {
  segs: readonly Seg[];
  seg: Int32Array;
  t0: Float64Array;
  t1: Float64Array;
}

/** An arrangement's vertices and the chord pieces along each edge, start to end. */
export interface ChordEdges {
  xs: readonly number[];
  ys: readonly number[];
  origin: readonly number[];
  along: readonly (readonly Along[])[];
}

export interface PolishStats {
  /** Vertices where exactly two input segments, one of them curved, cross inside both. */
  crossings: number;
  /** Of those, the ones moved onto the curves' own crossing. */
  polished: number;
  /** The farthest a polish moved a vertex. */
  largestMove: number;
  /** The largest move as a share of the limit on it, which a polish never passes. */
  largestShare: number;
}

export interface Polish {
  /** Each moved vertex's new point. */
  at: Map<number, Point>;
  /** Each moved vertex's parameter on each segment crossing there, keyed by `vertex * segments + segment`. */
  t: Map<number, number>;
  stats: PolishStats;
}

const STEPS = 8;
/** Tangents meeting at less than this sine of their angle are a near-tangency, where Newton is not trusted. */
const MIN_SINE = 0.05;
/** Room past the flattening's own error, for Newton's. */
const MARGIN = 1.05;

/**
 * Where segment `seg` passes through a vertex: its parameter there, at the
 * vertices either side along it, and the chords of its flattening there.
 */
interface Pass { seg: number; t: number; beside: number[]; chords: number[] }

function passes(a: ChordEdges, c: Chords): Map<number, Pass[]> {
  const out = new Map<number, Pass[]>();
  const add = (v: number, chord: number, t: number, other: number) => {
    let list = out.get(v);
    if (!list) out.set(v, (list = []));
    const seg = c.seg[chord];
    const p = list.find((q) => q.seg === seg && Math.abs(q.t - t) <= 1e-12);
    if (!p) list.push({ seg, t, beside: [other], chords: [chord] });
    else {
      p.beside.push(other);
      if (!p.chords.includes(chord)) p.chords.push(chord);
    }
  };
  a.along.forEach((list, e) => {
    for (const al of list) {
      const t0 = c.t0[al.seg], dt = c.t1[al.seg] - t0;
      const ts = t0 + al.s0 * dt, te = t0 + al.s1 * dt;
      add(a.origin[2 * e], al.seg, ts, te);
      add(a.origin[2 * e + 1], al.seg, te, ts);
    }
  });
  return out;
}

/** Newton on A(ta) − B(tb) = 0 from the flattening's guess; null when it does not settle within `STEPS`. */
function solve(A: Seg, B: Seg, ta: number, tb: number, eps: number): [number, number] | null {
  for (let i = 0; i < STEPS; i++) {
    const pa = evalSeg(A, ta), pb = evalSeg(B, tb);
    const fx = pa.x - pb.x, fy = pa.y - pb.y;
    if (Math.hypot(fx, fy) <= eps) return [ta, tb];
    const da = derivSeg(A, ta), db = derivSeg(B, tb);
    const det = -da.x * db.y + da.y * db.x;
    if (det === 0) return null;
    ta += (fx * db.y - fy * db.x) / det;
    tb += (da.y * fx - da.x * fy) / det;
    if (!(ta > 0 && ta < 1 && tb > 0 && tb < 1)) return null;
  }
  const pa = evalSeg(A, ta), pb = evalSeg(B, tb);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y) <= eps ? [ta, tb] : null;
}

function sine(A: Seg, B: Seg, ta: number, tb: number): number {
  const da = derivSeg(A, ta), db = derivSeg(B, tb);
  const la = Math.hypot(da.x, da.y), lb = Math.hypot(db.x, db.y);
  return la === 0 || lb === 0 ? 0 : Math.abs(da.x * db.y - da.y * db.x) / (la * lb);
}

/** The sine of the angle between two chords. */
function chordSine(c: Chords, i: number, j: number): number {
  const a0 = evalSeg(c.segs[c.seg[i]], c.t0[i]), a1 = evalSeg(c.segs[c.seg[i]], c.t1[i]);
  const b0 = evalSeg(c.segs[c.seg[j]], c.t0[j]), b1 = evalSeg(c.segs[c.seg[j]], c.t1[j]);
  const ax = a1.x - a0.x, ay = a1.y - a0.y, bx = b1.x - b0.x, by = b1.y - b0.y;
  const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
  return la === 0 || lb === 0 ? 0 : Math.abs(ax * by - ay * bx) / (la * lb);
}

/**
 * How far the flattening can have put a crossing from the curves' own: each
 * chord lies within `tolerance` of its curve, so two meeting at angle θ cross
 * within 2·tolerance/sin θ of where the curves do. Of the chord pairs meeting
 * there, the steepest, so the bound is the tighter one.
 */
function moveLimit(c: Chords, p: Pass, q: Pass, tolerance: number): number {
  let best = 0;
  for (const i of p.chords) for (const j of q.chords) best = Math.max(best, chordSine(c, i, j));
  return best === 0 ? 0 : (MARGIN * 2 * tolerance) / best;
}

/** Moving `p`'s parameter to `t` keeps it nearer its own place than halfway to either neighbor's along the segment. */
const staysInOrder = (p: Pass, t: number): boolean => p.beside.every((b) => Math.abs(t - p.t) < Math.abs(b - p.t) / 2);

/**
 * The crossings of `a` moved onto the curves they flatten. A crossing stays
 * put where Newton does not settle, where it would move farther than the
 * flattening could have misplaced it (`moveLimit`) or past halfway to a
 * neighboring vertex along either segment, or where the two curves meet
 * nearly tangent.
 */
export function polishCrossings(a: ChordEdges, c: Chords, tolerance: number, extent: number): Polish {
  const at = new Map<number, Point>();
  const t = new Map<number, number>();
  const stats: PolishStats = { crossings: 0, polished: 0, largestMove: 0, largestShare: 0 };
  const eps = extent * 1e-12;
  for (const [v, list] of passes(a, c)) {
    if (list.length !== 2) continue;
    const [p, q] = list;
    const A = c.segs[p.seg], B = c.segs[q.seg];
    if (p.seg === q.seg || (A.length === 2 && B.length === 2)) continue;
    if (!(p.t > 0 && p.t < 1 && q.t > 0 && q.t < 1)) continue;
    stats.crossings++;
    const hit = solve(A, B, p.t, q.t, eps);
    if (!hit || !staysInOrder(p, hit[0]) || !staysInOrder(q, hit[1])) continue;
    if (sine(A, B, hit[0], hit[1]) < MIN_SINE || sine(A, B, p.t, q.t) < MIN_SINE) continue;
    const pt = evalSeg(A, hit[0]);
    const move = Math.hypot(pt.x - a.xs[v], pt.y - a.ys[v]);
    const limit = moveLimit(c, p, q, tolerance);
    if (move > limit) continue;
    stats.polished++;
    stats.largestMove = Math.max(stats.largestMove, move);
    stats.largestShare = Math.max(stats.largestShare, move / limit);
    at.set(v, pt);
    t.set(v * c.segs.length + p.seg, hit[0]);
    t.set(v * c.segs.length + q.seg, hit[1]);
  }
  return { at, t, stats };
}
