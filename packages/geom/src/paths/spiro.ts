/**
 * Spiro curves: a spline defined by on-curve points alone. Between each pair
 * of neighboring points runs an Euler-spiral segment (`eulerSpiral`), and the
 * segments are solved together so that, at every smooth point, both the
 * tangent and the curvature carry straight through. The curve has no handles
 * to tune; moving a point re-solves the whole curve.
 *
 * Each point's kind says what holds at it:
 *
 * | kind | at the point |
 * |---|---|
 * | `smooth` | tangent and curvature continue (G2); next to a straight segment, the curve leaves along the line |
 * | `g4` | tangent, curvature, and the curvature's first two derivatives continue (G4); otherwise as `smooth` |
 * | `corner` | the two sides are independent; each meets the point with zero curvature |
 * | `left` | the segment arriving is straight, and the curve leaving continues the line |
 * | `right` | the segment leaving is straight, and the curve arriving runs into the line |
 *
 * The ends of an open curve meet their points with zero curvature, as a
 * corner's sides do.
 *
 * A segment with a `g4` point at either end is a cubic-curvature segment,
 * with two more unknowns than an Euler spiral's two end tangents. A `g4`
 * point between two curved segments pays for its side's two with its two
 * extra equations; anywhere else, such a segment's curvature stops bending
 * at that end (its second derivative is zero there).
 */
import { wrapAngle } from '../angle';
import type { Point } from './cubicMath';
import {
  eulerAngleAt, eulerCurvatureAt, eulerCurvatureDerivativesAt, fitEulerSegment, placeEulerSegment,
  type EulerSegment,
} from './eulerSpiral';
import { distance } from '../points2';

/** What holds at a spiro point; see the table at the top of `spiro.ts`. */
export type SpiroKind = 'smooth' | 'g4' | 'corner' | 'left' | 'right';

/** Every {@link SpiroKind}, in the order a picker lists them. */
export const SPIRO_KINDS: readonly SpiroKind[] = ['smooth', 'g4', 'corner', 'left', 'right'];

/** One on-curve point of a spiro curve. */
export interface SpiroPoint {
  x: number;
  y: number;
  kind: SpiroKind;
}

/** One solved segment of a spiro curve: a straight line, or a placed Euler
 *  spiral (`spiral`) between the two points. */
export interface SpiroSegment {
  from: Point;
  to: Point;
  spiral: EulerSegment | null;
}

type Side = { kind: 'none' } | { kind: 'line'; angle: number } | { kind: 'curve'; seg: number };

const wrap = (a: number): number => wrapAngle(a, 'min');
const angleOf = (p: Point, q: Point): number => Math.atan2(q.y - p.y, q.x - p.x);

/** Whether `kind` is one of the {@link SpiroKind}s. */
export function isSpiroKind(kind: unknown): kind is SpiroKind {
  return SPIRO_KINDS.includes(kind as SpiroKind);
}

interface System {
  points: readonly SpiroPoint[];
  /** Segment `i` runs from point `i` to point `ends[i]`. */
  ends: number[];
  straight: boolean[];
  /** The first unknown slot of each curved segment (start tangent, end
   *  tangent, then a cubic-curvature segment's two higher terms), or -1. */
  slot: number[];
  /** Whether each segment is a cubic-curvature one. */
  cubic: boolean[];
  unknowns: number;
}

function buildSystem(points: readonly SpiroPoint[], closed: boolean): System {
  const n = points.length;
  const count = closed ? n : n - 1;
  const ends: number[] = [];
  const straight: boolean[] = [];
  const slot: number[] = [];
  const cubic: boolean[] = [];
  let unknowns = 0;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % n;
    ends.push(j);
    const line = points[i].kind === 'right' || points[j].kind === 'left'
      || distance(points[i], points[j]) < 1e-9;
    straight.push(line);
    slot.push(line ? -1 : unknowns);
    const higher = !line && (points[i].kind === 'g4' || points[j].kind === 'g4');
    cubic.push(higher);
    if (!line) unknowns += higher ? 4 : 2;
  }
  return { points, ends, straight, slot, cubic, unknowns };
}

function sides(sys: System, closed: boolean, i: number): [Side, Side] {
  const n = sys.points.length;
  const count = sys.ends.length;
  const side = (seg: number): Side => {
    if (seg < 0 || seg >= count) return { kind: 'none' };
    if (sys.straight[seg]) return { kind: 'line', angle: angleOf(sys.points[seg], sys.points[sys.ends[seg]]) };
    return { kind: 'curve', seg };
  };
  const into = i > 0 ? i - 1 : closed ? n - 1 : -1;
  const outOf = closed || i < n - 1 ? i : -1;
  return [side(into), side(outOf)];
}

interface Fitted { seg: EulerSegment; chord: number; startAngle: number; endAngle: number; cubic: boolean }

function fitSegment(sys: System, s: number, x: readonly number[]): Fitted {
  const p0 = sys.points[s];
  const p1 = sys.points[sys.ends[s]];
  const chord = angleOf(p0, p1);
  const k = sys.slot[s];
  const fit = sys.cubic[s]
    ? fitEulerSegment(wrap(x[k] - chord), wrap(x[k + 1] - chord), x[k + 2], x[k + 3])
    : fitEulerSegment(wrap(x[k] - chord), wrap(x[k + 1] - chord));
  const seg = placeEulerSegment(fit, p0, p1);
  const startAngle = eulerAngleAt(seg, 0);
  return { seg, chord: distance(p0, p1), startAngle, endAngle: eulerAngleAt(seg, 1), cubic: sys.cubic[s] };
}

/** Curvature at one end of `f`, times its chord so every equation is on one scale. */
const bend = (f: Fitted, at: 0 | 1): number => eulerCurvatureAt(f.seg, at) * f.chord;

/** The second derivative of curvature at one end of `f`, on the same scale. */
const twist = (f: Fitted, at: 0 | 1): number => eulerCurvatureDerivativesAt(f.seg, at)[1] * f.chord ** 3;

/** Angle, curvature, and the curvature's first two derivatives matched where
 *  `fa` ends and `fb` begins. */
function g4Join(fa: Fitted, fb: Fitted): number[] {
  const scale = (fa.chord + fb.chord) / 2;
  const [a1, a2] = eulerCurvatureDerivativesAt(fa.seg, 1);
  const [b1, b2] = eulerCurvatureDerivativesAt(fb.seg, 0);
  return [
    wrap(fa.endAngle - fb.startAngle),
    (eulerCurvatureAt(fa.seg, 1) - eulerCurvatureAt(fb.seg, 0)) * scale,
    (a1 - b1) * scale ** 2,
    (a2 - b2) * scale ** 3,
  ];
}

function residuals(sys: System, closed: boolean, fits: readonly Fitted[]): number[] {
  const out: number[] = [];
  const fitOf = (side: Side): Fitted => fits[(side as { seg: number }).seg];
  for (let i = 0; i < sys.points.length; i++) {
    const [a, b] = sides(sys, closed, i);
    const kind = sys.points[i].kind;
    const ac = a.kind === 'curve';
    const bc = b.kind === 'curve';
    if (!ac && !bc) continue;
    if (kind === 'g4' && ac && bc) {
      out.push(...g4Join(fitOf(a), fitOf(b)));
      continue;
    }
    if (kind === 'smooth' && ac && bc) {
      const fa = fitOf(a), fb = fitOf(b);
      out.push(...g4Join(fa, fb).slice(0, 2));
      if (fa.cubic) out.push(twist(fa, 1));
      if (fb.cubic) out.push(twist(fb, 0));
      continue;
    }
    // One curved side from here on, or a corner's two independent ones.
    for (const [side, other, at] of [[a, b, 1], [b, a, 0]] as const) {
      if (side.kind !== 'curve') continue;
      const f = fitOf(side);
      const angle = at === 1 ? f.endAngle : f.startAngle;
      const followsLine = other.kind === 'line' && kind !== 'corner';
      out.push(followsLine ? wrap(angle - other.angle) : bend(f, at));
      if (f.cubic) out.push(twist(f, at));
    }
  }
  return out;
}

/** A starting tangent at each point: along the bisector of its two chords. */
function initialGuess(sys: System, closed: boolean): number[] {
  const x = new Array<number>(sys.unknowns).fill(0);
  const n = sys.points.length;
  const tangentAt = (i: number, seg: number): number => {
    const chord = angleOf(sys.points[seg], sys.points[sys.ends[seg]]);
    const [a, b] = sides(sys, closed, i);
    if (sys.points[i].kind === 'corner' || a.kind === 'none' || b.kind === 'none') return chord;
    if (a.kind === 'line') return a.angle;
    if (b.kind === 'line') return b.angle;
    const prev = sys.points[(i - 1 + n) % n];
    const next = sys.points[(i + 1) % n];
    const pin = angleOf(prev, sys.points[i]);
    const pout = angleOf(sys.points[i], next);
    return pin + wrap(pout - pin) / 2;
  };
  for (let s = 0; s < sys.ends.length; s++) {
    const k = sys.slot[s];
    if (k < 0) continue;
    x[k] = tangentAt(s, s);
    x[k + 1] = tangentAt(sys.ends[s], s);
  }
  return x;
}

/** Solve `m · d = r` in place by Gaussian elimination with partial pivoting. */
function solveLinear(m: number[][], r: number[]): number[] | null {
  const n = r.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(m[i][c]) > Math.abs(m[p][c])) p = i;
    if (Math.abs(m[p][c]) < 1e-14) return null;
    [m[c], m[p]] = [m[p], m[c]];
    [r[c], r[p]] = [r[p], r[c]];
    for (let i = c + 1; i < n; i++) {
      const f = m[i][c] / m[c][c];
      if (f === 0) continue;
      for (let j = c; j < n; j++) m[i][j] -= f * m[c][j];
      r[i] -= f * r[c];
    }
  }
  const out = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let v = r[i];
    for (let j = i + 1; j < n; j++) v -= m[i][j] * out[j];
    out[i] = v / m[i][i];
  }
  return out;
}

const norm = (v: readonly number[]): number => Math.sqrt(v.reduce((s, e) => s + e * e, 0));

/**
 * Solve the spiro curve through `points`. A closed curve has a segment from
 * the last point back to the first. Fewer than two points make no segments.
 */
export function solveSpiro(points: readonly SpiroPoint[], closed: boolean): SpiroSegment[] {
  if (points.length < 2) return [];
  const sys = buildSystem(points, closed && points.length > 2);
  const isClosed = closed && points.length > 2;
  let x = initialGuess(sys, isClosed);
  const fitAll = (v: readonly number[]): Fitted[] =>
    sys.ends.map((_, s) => (sys.slot[s] < 0 ? (null as unknown as Fitted) : fitSegment(sys, s, v)));
  let fits = fitAll(x);
  let r = residuals(sys, isClosed, fits);
  for (let iter = 0; iter < 40 && sys.unknowns > 0; iter++) {
    const err = norm(r);
    if (err < 1e-10) break;
    // Each unknown moves only its own segment, so a column refits one segment.
    const jac = r.map(() => new Array<number>(sys.unknowns).fill(0));
    for (let s = 0; s < sys.ends.length; s++) {
      const k = sys.slot[s];
      if (k < 0) continue;
      for (let u = k; u < k + (sys.cubic[s] ? 4 : 2); u++) {
        const h = 1e-6;
        const xs = x.slice();
        xs[u] += h;
        const moved = fits.slice();
        moved[s] = fitSegment(sys, s, xs);
        const rs = residuals(sys, isClosed, moved);
        for (let e = 0; e < r.length; e++) jac[e][u] = (rs[e] - r[e]) / h;
      }
    }
    const step = solveLinear(jac, r.map((v) => -v));
    if (!step) break;
    // Halve the step until it lowers the error.
    let t = 1;
    let accepted = false;
    for (let tries = 0; tries < 12; tries++, t /= 2) {
      const xt = x.map((v, i) => v + t * step[i]);
      const ft = fitAll(xt);
      const rt = residuals(sys, isClosed, ft);
      if (norm(rt) < err) {
        x = xt; fits = ft; r = rt; accepted = true;
        break;
      }
    }
    if (!accepted) break;
  }
  return sys.ends.map((end, s) => ({
    from: { x: points[s].x, y: points[s].y },
    to: { x: points[end].x, y: points[end].y },
    spiral: sys.slot[s] < 0 ? null : fits[s].seg,
  }));
}
