/**
 * A filled region grown outward by a distance, without a boolean: each
 * contour's edges moved out along their normals, convex corners joined, and
 * the overlaps that leaves fill once under `'nonzero'`. Curves stay curves.
 */
import { cubicEvalAt } from '../curve';
import type { Path, PolygonPath } from '../path';
import { PathBuilder } from './builder';
import { lineSegment, pathToCubicContours, splitSegment, type CubicSegment } from './cubicContours';
import { pathSignedArea } from './winding';

/** Options for {@link growRegion}. */
export interface GrowRegionOptions {
  /** How a convex corner turns. `'miter'` keeps it sharp, as a pseudo-distance
   *  field draws it; `'round'` follows the true distance. Default `'miter'`. */
  join?: 'miter' | 'round';
  /** Past this ratio of miter length to distance a miter corner is beveled.
   *  Default 4. */
  miterLimit?: number;
  /** How far a grown curve may stray from the true offset, in the path's
   *  units. Default 0.1. */
  tolerance?: number;
}

type Pt = [number, number];
type Seg = CubicSegment;

const MAX_DEPTH = 6;
const SAMPLES = [0.2, 0.35, 0.5, 0.65, 0.8];

/**
 * The region `path` fills under `'nonzero'`, grown by `distance` (> 0), as a
 * path that fills it under `'nonzero'`. Every subpath counts as closed. Each
 * contour is replaced by its offset, so where grown parts meet the contours
 * overlap rather than merge, and a hole grown shut winds back on itself and
 * fills. At an inside corner the two offset edges are cut back to where they
 * cross; where they do not, the gap is passed through the corner's original
 * point, which closes it with a loop inside the fill. `mergeRegion`
 * redraws the result as its outline alone, for a stroke.
 *
 * What it costs: one segment per curve, more where `tolerance` needs the curve
 * split; a miter corner between two straight edges costs nothing, one beside
 * a curve gains an anchor or two, a round corner an arc, and an inside corner
 * whose edges do not cross two.
 */
export function growRegion(path: Path, distance: number, opts: GrowRegionOptions = {}): PolygonPath {
  const b = new PathBuilder();
  if (!(distance > 0)) return b.build();
  const sigma = pathSignedArea(path) < 0 ? -1 : 1;
  const ctx: Ctx = {
    d: distance,
    sigma,
    tol: opts.tolerance ?? 0.1,
    join: opts.join ?? 'miter',
    miterLimit: opts.miterLimit ?? 4,
  };
  for (const contour of pathToCubicContours(path)) {
    const segs = contour.segs.filter((s) => !degenerate(s));
    if (segs.length === 0) continue;
    const last = segs.at(-1)!.c,
      first = segs[0]!.c;
    if (last[6] !== first[0] || last[7] !== first[1]) segs.push(lineSegment(last[6], last[7], first[0], first[1]));
    emitContour(b, growContour(segs, ctx));
  }
  return b.build();
}

interface Ctx {
  d: number;
  sigma: number;
  tol: number;
  join: 'miter' | 'round';
  miterLimit: number;
}

/** One source segment's offset pieces, and the pieces joining it to the next. */
interface Grown {
  pieces: Seg[];
  join: Seg[];
}

function growContour(segs: readonly Seg[], ctx: Ctx): Grown[] {
  const out: Grown[] = segs.map((s) => ({
    pieces: offsetSeg(s, ctx, 0),
    join: [],
  }));
  for (let i = 0; i < segs.length; i++) {
    const j = (i + 1) % segs.length;
    const tin = endTangent(segs[i]!.c),
      tout = startTangent(segs[j]!.c);
    const v: Pt = [segs[j]!.c[0], segs[j]!.c[1]];
    out[i]!.join = joinPieces(out[i]!, out[j]!, v, tin, tout, ctx);
  }
  return out;
}

function joinPieces(prev: Grown, next: Grown, v: Pt, tin: Pt, tout: Pt, ctx: Ctx): Seg[] {
  const a = endOf(prev.pieces.at(-1)!),
    b = startOf(next.pieces[0]!);
  const gap = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (gap <= ctx.tol * 1e-3) return [];
  const cross = tin[0] * tout[1] - tin[1] * tout[0];
  const dot = tin[0] * tout[0] + tin[1] * tout[1];
  const convex = ctx.sigma * cross > 0 || (Math.abs(cross) < 1e-9 && dot < 0);
  if (gap <= ctx.tol) return snap(prev, next, a);
  if (!convex) {
    if (trimAtCrossing(prev, next)) return [];
    return [lineSegment(a[0], a[1], v[0], v[1]), lineSegment(v[0], v[1], b[0], b[1])];
  }
  const nin = normal(tin, ctx.sigma),
    nout = normal(tout, ctx.sigma);
  if (ctx.join === 'round') return arc(v, ctx.d, nin, Math.atan2(cross, dot));
  const cos = nin[0] * nout[0] + nin[1] * nout[1];
  if (1 + cos < 1e-9 || Math.sqrt(2 / (1 + cos)) > ctx.miterLimit) return [lineSegment(a[0], a[1], b[0], b[1])];
  const k = ctx.d / (1 + cos);
  const m: Pt = [v[0] + (nin[0] + nout[0]) * k, v[1] + (nin[1] + nout[1]) * k];
  return miter(prev, next, m);
}

/** A gap inside the tolerance closed by moving the next piece's start onto
 *  `a`, its first handle with it, rather than by a segment of its own. */
function snap(prev: Grown, next: Grown, a: Pt): Seg[] {
  const n = next.pieces[0]!;
  if (n === prev.pieces.at(-1)) return [lineSegment(n.c[6], n.c[7], a[0], a[1])];
  next.pieces[0] = n.line
    ? lineSegment(a[0], a[1], n.c[6], n.c[7])
    : {
        c: [a[0], a[1], n.c[2] + a[0] - n.c[0], n.c[3] + a[1] - n.c[1], n.c[4], n.c[5], n.c[6], n.c[7]],
        line: false,
      };
  return [];
}

/** The miter point joined in, a straight edge either side carried on to it
 *  rather than gaining an anchor. */
function miter(prev: Grown, next: Grown, m: Pt): Seg[] {
  const p = prev.pieces.at(-1)!,
    n = next.pieces[0]!;
  const out: Seg[] = [];
  if (p.line && p !== n) prev.pieces[prev.pieces.length - 1] = lineSegment(p.c[0], p.c[1], m[0], m[1]);
  else out.push(lineSegment(p.c[6], p.c[7], m[0], m[1]));
  if (n.line && p !== n) next.pieces[0] = lineSegment(m[0], m[1], n.c[6], n.c[7]);
  else out.push(lineSegment(m[0], m[1], n.c[0], n.c[1]));
  return out;
}

/**
 * Cut the offset pieces either side of an inside corner back to where they
 * cross, when they do. The crossing is found on a flattening of each, and both
 * cut ends are moved onto the one point between them.
 */
function trimAtCrossing(prev: Grown, next: Grown): boolean {
  const p = prev.pieces.at(-1)!,
    n = next.pieces[0]!;
  if (p === n) return false;
  const hit = crossing(p.c, n.c);
  if (hit === null) return false;
  const left = hit[0] >= 1 ? p : splitSegment(p, hit[0])[0];
  const right = hit[1] <= 0 ? n : splitSegment(n, hit[1])[1];
  const x = (left.c[6] + right.c[0]) / 2,
    y = (left.c[7] + right.c[1]) / 2;
  prev.pieces[prev.pieces.length - 1] = left.line
    ? lineSegment(left.c[0], left.c[1], x, y)
    : {
        c: [left.c[0], left.c[1], left.c[2], left.c[3], left.c[4] + x - left.c[6], left.c[5] + y - left.c[7], x, y],
        line: false,
      };
  next.pieces[0] = right.line
    ? lineSegment(x, y, right.c[6], right.c[7])
    : {
        c: [
          x,
          y,
          right.c[2] + x - right.c[0],
          right.c[3] + y - right.c[1],
          right.c[4],
          right.c[5],
          right.c[6],
          right.c[7],
        ],
        line: false,
      };
  return true;
}

const CROSS_SAMPLES = 32;

/** Where `a` crosses `b`, as a parameter on each: the crossing nearest `a`'s
 *  end and `b`'s start, or `null` when they do not cross. */
function crossing(a: Seg['c'], b: Seg['c']): [number, number] | null {
  const pa = flatten(a),
    pb = flatten(b);
  let best: [number, number] | null = null,
    score = Infinity;
  for (let i = 0; i < CROSS_SAMPLES; i++) {
    for (let j = 0; j < CROSS_SAMPLES; j++) {
      const hit = segmentsCross(pa[i]!, pa[i + 1]!, pb[j]!, pb[j + 1]!);
      if (hit === null) continue;
      const ta = (i + hit[0]) / CROSS_SAMPLES,
        tb = (j + hit[1]) / CROSS_SAMPLES;
      if (ta <= 1e-9 || tb >= 1 - 1e-9 || 1 - ta + tb >= score) continue;
      score = 1 - ta + tb;
      best = [ta, tb];
    }
  }
  return best;
}

function flatten(c: Seg['c']): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= CROSS_SAMPLES; i++) out.push(cubicEvalAt(...c, i / CROSS_SAMPLES));
  return out;
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): [number, number] | null {
  const rx = b[0] - a[0],
    ry = b[1] - a[1],
    sx = d[0] - c[0],
    sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-18) return null;
  const u = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
  const w = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
  return u >= 0 && u <= 1 && w >= 0 && w <= 1 ? [u, w] : null;
}

/** A circular arc about `c` of radius `r`, from normal `n0` turning by `sweep`. */
function arc(c: Pt, r: number, n0: Pt, sweep: number): Seg[] {
  const parts = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
  const step = sweep / parts;
  const h = (4 / 3) * Math.tan(step / 4) * r;
  const start = Math.atan2(n0[1], n0[0]);
  const out: Seg[] = [];
  for (let i = 0; i < parts; i++) {
    const t0 = start + step * i,
      t1 = t0 + step;
    const x0 = c[0] + Math.cos(t0) * r,
      y0 = c[1] + Math.sin(t0) * r;
    const x3 = c[0] + Math.cos(t1) * r,
      y3 = c[1] + Math.sin(t1) * r;
    out.push({
      c: [x0, y0, x0 - Math.sin(t0) * h, y0 + Math.cos(t0) * h, x3 + Math.sin(t1) * h, y3 - Math.cos(t1) * h, x3, y3],
      line: false,
    });
  }
  return out;
}

/**
 * `seg` moved out by `d`. A curve's ends move along their normals and its
 * handles scale by `1 + d·κ`, which matches the offset's first derivative
 * there; a piece that strays past the tolerance is split and retried.
 */
function offsetSeg(seg: Seg, ctx: Ctx, depth: number): Seg[] {
  const c = seg.c;
  const n0 = normal(startTangent(c), ctx.sigma),
    n1 = normal(endTangent(c), ctx.sigma);
  const { d } = ctx;
  if (seg.line) return [lineSegment(c[0] + n0[0] * d, c[1] + n0[1] * d, c[6] + n0[0] * d, c[7] + n0[1] * d)];
  const k0 = Math.max(0, 1 + ctx.sigma * d * curvatureAt(c, 0));
  const k1 = Math.max(0, 1 + ctx.sigma * d * curvatureAt(c, 1));
  const q0x = c[0] + n0[0] * d,
    q0y = c[1] + n0[1] * d;
  const q3x = c[6] + n1[0] * d,
    q3y = c[7] + n1[1] * d;
  const out: Seg = {
    c: [
      q0x,
      q0y,
      q0x + (c[2] - c[0]) * k0,
      q0y + (c[3] - c[1]) * k0,
      q3x + (c[4] - c[6]) * k1,
      q3y + (c[5] - c[7]) * k1,
      q3x,
      q3y,
    ],
    line: false,
  };
  if (depth >= MAX_DEPTH || offsetError(c, out.c, ctx) <= ctx.tol) return [out];
  const [l, r] = splitSegment(seg, 0.5);
  return [...offsetSeg(l, ctx, depth + 1), ...offsetSeg(r, ctx, depth + 1)];
}

function offsetError(c: Seg['c'], q: Seg['c'], ctx: Ctx): number {
  let worst = 0;
  for (const t of SAMPLES) {
    const [dx, dy] = derivative(c, t);
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) continue;
    const [bx, by] = cubicEvalAt(...c, t);
    const tx = bx + ((ctx.sigma * dy) / len) * ctx.d,
      ty = by - ((ctx.sigma * dx) / len) * ctx.d;
    const [ox, oy] = cubicEvalAt(...q, t);
    worst = Math.max(worst, Math.hypot(ox - tx, oy - ty));
  }
  return worst;
}

function derivative(c: Seg['c'], t: number): Pt {
  const u = 1 - t;
  const a = 3 * u * u,
    b = 6 * u * t,
    e = 3 * t * t;
  return [
    a * (c[2] - c[0]) + b * (c[4] - c[2]) + e * (c[6] - c[4]),
    a * (c[3] - c[1]) + b * (c[5] - c[3]) + e * (c[7] - c[5]),
  ];
}

/** Signed curvature at an end, positive turning left; 0 where the handle is
 *  absent, whose offset handle is then absent too. */
function curvatureAt(c: Seg['c'], end: 0 | 1): number {
  const [d1x, d1y] = end === 0 ? [c[2] - c[0], c[3] - c[1]] : [c[6] - c[4], c[7] - c[5]];
  const [d2x, d2y] =
    end === 0 ? [c[0] - 2 * c[2] + c[4], c[1] - 2 * c[3] + c[5]] : [c[6] - 2 * c[4] + c[2], c[7] - 2 * c[5] + c[3]];
  const len = Math.hypot(d1x, d1y);
  if (len < 1e-12) return 0;
  // B' = 3·d1, B'' = 6·d2: κ = (B'×B'')/|B'|³ = (2/3)(d1×d2)/|d1|³.
  return ((2 / 3) * (d1x * d2y - d1y * d2x)) / (len * len * len);
}

function startTangent(c: Seg['c']): Pt {
  return unit(c[2] - c[0], c[3] - c[1]) ?? unit(c[4] - c[0], c[5] - c[1]) ?? unit(c[6] - c[0], c[7] - c[1]) ?? [1, 0];
}

function endTangent(c: Seg['c']): Pt {
  return unit(c[6] - c[4], c[7] - c[5]) ?? unit(c[6] - c[2], c[7] - c[3]) ?? unit(c[6] - c[0], c[7] - c[1]) ?? [1, 0];
}

function unit(x: number, y: number): Pt | null {
  const l = Math.hypot(x, y);
  return l < 1e-12 ? null : [x / l, y / l];
}

/** The outward normal: right of travel for a positively wound region. */
function normal(t: Pt, sigma: number): Pt {
  return [sigma * t[1], -sigma * t[0]];
}

function degenerate(s: Seg): boolean {
  const c = s.c;
  return c[0] === c[6] && c[1] === c[7] && c[0] === c[2] && c[1] === c[3] && c[0] === c[4] && c[1] === c[5];
}

const startOf = (s: Seg): Pt => [s.c[0], s.c[1]];
const endOf = (s: Seg): Pt => [s.c[6], s.c[7]];

function emitContour(b: PathBuilder, grown: readonly Grown[]): void {
  const first = grown[0]!.pieces[0]!;
  b.moveTo(first.c[0], first.c[1]);
  for (const g of grown) {
    for (const s of [...g.pieces, ...g.join]) {
      if (s.line) b.lineTo(s.c[6], s.c[7]);
      else b.curveTo(s.c[2], s.c[3], s.c[4], s.c[5], s.c[6], s.c[7]);
    }
  }
  b.close();
}
