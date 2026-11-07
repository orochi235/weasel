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

/** Where segment `seg` passes through a vertex: its parameter there, and at the vertices either side along it. */
interface Pass { seg: number; t: number; beside: number[] }

function passes(a: ChordEdges, c: Chords): Map<number, Pass[]> {
  const out = new Map<number, Pass[]>();
  const add = (v: number, seg: number, t: number, other: number) => {
    let list = out.get(v);
    if (!list) out.set(v, (list = []));
    const p = list.find((q) => q.seg === seg && Math.abs(q.t - t) <= 1e-12);
    if (p) p.beside.push(other); else list.push({ seg, t, beside: [other] });
  };
  a.along.forEach((list, e) => {
    for (const al of list) {
      const t0 = c.t0[al.seg], dt = c.t1[al.seg] - t0;
      const ts = t0 + al.s0 * dt, te = t0 + al.s1 * dt;
      add(a.origin[2 * e], c.seg[al.seg], ts, te);
      add(a.origin[2 * e + 1], c.seg[al.seg], te, ts);
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

/** Moving `p`'s parameter to `t` keeps it nearer its own place than halfway to either neighbor's along the segment. */
const staysInOrder = (p: Pass, t: number): boolean => p.beside.every((b) => Math.abs(t - p.t) < Math.abs(b - p.t) / 2);

/**
 * The crossings of `a` moved onto the curves they flatten, within `tolerance`
 * of where the flattening put them. A crossing stays put where Newton does
 * not settle, where it would move farther than `tolerance` or past a
 * neighboring vertex along either segment, or where the two curves meet
 * nearly tangent.
 */
export function polishCrossings(a: ChordEdges, c: Chords, tolerance: number, extent: number): Polish {
  const at = new Map<number, Point>();
  const t = new Map<number, number>();
  const stats: PolishStats = { crossings: 0, polished: 0, largestMove: 0 };
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
    if (move > tolerance) continue;
    stats.polished++;
    stats.largestMove = Math.max(stats.largestMove, move);
    at.set(v, pt);
    t.set(v * c.segs.length + p.seg, hit[0]);
    t.set(v * c.segs.length + q.seg, hit[1]);
  }
  return { at, t, stats };
}
