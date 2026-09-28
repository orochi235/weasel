import { splitCubicAt, splitQuadraticAt, segmentsCross, pointInPolygon } from '@weasel-js/geom';
import type { Path, PolygonPath, PathFillRule } from './types';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from './types';
import type { Point } from './cubicMath';
import { pathUnion } from './booleans';

export type { Point };

/** Options for `splitPathBySegment` and `splitPathByPolyline`. */
export interface SplitBySegmentOptions {
  /**
   * Flattening tolerance for the check that decides whether contours cross
   * each other. Only a path whose contours do cross is flattened (see
   * `splitPathByPolyline`).
   */
  flattenTolerance?: number;
}

/** A Bézier segment by its control points: 2 = line, 3 = quadratic, 4 = cubic. */
type Seg = Point[];
type Contour = Seg[];

/** A point on a contour: segment index and parameter. */
interface Station {
  seg: number;
  t: number;
  pt: Point;
}

interface Crossing extends Station {
  contour: number;
  /** Position along the cut: cut segment k runs from k to k + 1. */
  s: number;
  /** True where the cut, going forward, enters the filled region. */
  enters: boolean;
}

/**
 * Split `path` along the finite segment a→b into closed pieces (Knife).
 * The same as {@link splitPathByPolyline} with a two-point cut.
 */
export function splitPathBySegment(
  path: Path,
  a: Point,
  b: Point,
  opts: SplitBySegmentOptions = {},
): Path[] | null {
  return splitPathByPolyline(path, [a, b], opts);
}

/**
 * Split `path` along the open polyline `cut` into closed pieces (Knife). A
 * freehand cut is a polyline through its samples.
 *
 * Only chords the cut crosses end to end are cut: a stretch of the cut that
 * starts or stops inside the fill cuts nothing, and nothing beyond the cut's
 * ends is touched, so a concave shape splits exactly where the stroke crosses
 * it. Curves are split at the crossing parameters by de Casteljau
 * subdivision, so every piece traces the original boundary exactly and keeps
 * its quadratic and cubic segments; the new edges follow the cut as straight
 * lines, bends included.
 *
 * A loop the cut draws inside the fill is dropped: the new edge runs straight
 * across the point where the cut crosses its own track. Chords that cross each
 * other are cut one after another, so a cross-hatch yields every piece.
 *
 * Each connected piece the cut produces is returned as its own path, holes
 * included. Contours the cut misses entirely are returned together as one
 * final piece. A single chord that does not disconnect the shape (across a
 * ring, say) returns one slit piece.
 *
 * A path whose contours cross each other or themselves is first resolved into
 * non-overlapping rings by a polygon union, which flattens its curves.
 *
 * Returns `null` when no chord is cut.
 */
export function splitPathByPolyline(
  path: Path,
  cut: readonly Point[],
  opts: SplitBySegmentOptions = {},
): Path[] | null {
  const pts = distinctPoints(cut);
  if (pts.length < 2) return null;
  return knife(path, pts, opts, pts.length);
}

function knife(path: Path, cut: Point[], opts: SplitBySegmentOptions, budget: number): Path[] | null {
  const outRule: PathFillRule = path.kind === 'polygon' ? path.fillRule : 'nonzero';

  let contours = parseContours(path);
  let fillRule = outRule;
  if (contoursIntersect(contours, opts.flattenTolerance ?? 0.5)) {
    contours = parseContours(pathUnion(path));
    fillRule = 'nonzero';
  }

  const boundaries = orientBoundaries(contours, fillRule);
  if (boundaries.length === 0) return null;

  const crossings = findCrossings(boundaries, cut);
  const partner = new Map<Crossing, Crossing>();
  const chord = new Map<Crossing, Point[]>();
  const accepted: Point[][] = [];
  let deferred = false;
  for (let k = 0; k + 1 < crossings.length; k++) {
    const c0 = crossings[k], c1 = crossings[k + 1];
    if (!c0.enters || c1.enters || c1.s - c0.s <= 1e-9) continue;
    const run = withoutLoops(cutBetween(cut, c0, c1));
    if (accepted.some((other) => polylinesCross(run, other))) { deferred = true; continue; }
    accepted.push(run);
    partner.set(c0, c1);
    partner.set(c1, c0);
    chord.set(c0, run);
    chord.set(c1, run.slice().reverse());
  }
  if (partner.size === 0) return null;

  const { loops, untouched } = traceLoops(boundaries, partner, chord);

  const traced = assembleRegions(loops, untouched.filter((c) => signedArea(c) < 0));
  const islands = untouched.filter((c) => signedArea(c) > 0);
  const regions: Contour[][] = traced.filter((r) => Math.abs(regionArea(r)) > 1e-6);
  if (islands.length > 0) {
    const leftover = untouched.filter((c) => !traced.some((r) => r.includes(c)));
    regions.push(leftover);
  }
  const pieces: Path[] = regions.map((r) => toPath(r, outRule));
  if (!deferred || budget <= 1) return pieces;
  return pieces.flatMap((p) => knife(p, cut, opts, budget - 1) ?? [p]);
}

/**
 * Split the stroke of `path` wherever the open polyline `cut` crosses it
 * (Scissors).
 *
 * Nothing is closed the way a fill closes it: an open subpath is cut into open
 * runs at each crossing, and a closed one is opened there, so a ring crossed
 * once becomes a single open run that starts and ends at the crossing. Curves
 * are split by de Casteljau subdivision, keeping their segment types. A
 * crossing at an end of an open subpath cuts nothing, and neither does a point
 * where the path only touches the cut.
 *
 * Each run is returned as its own path. Subpaths the cut misses are returned
 * together as one final piece.
 *
 * Returns `null` when nothing is cut.
 */
export function snipPathByPolyline(path: Path, cut: readonly Point[]): Path[] | null {
  const pts = distinctPoints(cut);
  if (pts.length < 2) return null;
  const rule: PathFillRule = path.kind === 'polygon' ? path.fillRule : 'nonzero';

  const runs: Contour[] = [];
  const missed: Subpath[] = [];
  for (const sub of parseSubpaths(path, false)) {
    const stops = snipStations(sub, pts);
    if (stops.length === 0) { missed.push(sub); continue; }
    const segs = sub.segs;
    if (sub.closed) {
      for (let i = 0; i < stops.length; i++) {
        runs.push(arcBetween(segs, stops[i], stops[(i + 1) % stops.length], stops.length === 1));
      }
    } else {
      const last = segs[segs.length - 1];
      const all: Station[] = [
        { seg: 0, t: 0, pt: segs[0][0] },
        ...stops,
        { seg: segs.length - 1, t: 1, pt: last[last.length - 1] },
      ];
      for (let i = 0; i + 1 < all.length; i++) runs.push(arcBetween(segs, all[i], all[i + 1], false));
    }
  }
  if (runs.length === 0) return null;

  const pieces = runs.filter((r) => r.length > 0).map((r) => writePath([{ segs: r, closed: false }], rule));
  if (missed.length > 0) pieces.push(writePath(missed, rule));
  return pieces;
}

/**
 * Where the cut splits one subpath, in order along it. Detections at one point
 * pair off: two there are the path touching the cut and leaving on the side it
 * came from.
 */
function snipStations(sub: Subpath, cut: Point[]): Station[] {
  const raw: Station[] = [];
  sub.segs.forEach((seg, si) => {
    for (let k = 0; k + 1 < cut.length; k++) {
      const a = cut[k];
      const d = { x: cut[k + 1].x - a.x, y: cut[k + 1].y - a.y };
      for (const c of signChanges(sideCoeffs(seg, a, d), true)) {
        const pt = evalSeg(seg, c.t);
        if (cutPosition(cut, k, pt) !== null) raw.push({ seg: si, t: c.t, pt });
      }
    }
  });
  raw.sort((x, y) => x.seg - y.seg || x.t - y.t);

  const same = (p: Point, q: Point) => Math.abs(p.x - q.x) <= 1e-7 && Math.abs(p.y - q.y) <= 1e-7;
  const groups: Station[][] = [];
  for (const st of raw) {
    const g = groups[groups.length - 1];
    if (g && same(g[0].pt, st.pt)) g.push(st); else groups.push([st]);
  }
  if (sub.closed && groups.length > 1 && same(groups[0][0].pt, groups[groups.length - 1][0].pt)) {
    groups[0].push(...groups.pop()!);
  }
  const first = sub.segs[0][0];
  const lastSeg = sub.segs[sub.segs.length - 1];
  const end = lastSeg[lastSeg.length - 1];
  return groups
    .filter((g) => g.length % 2 === 1)
    .map((g) => g[0])
    .filter((st) => sub.closed || (!same(st.pt, first) && !same(st.pt, end)));
}

// ---------------------------------------------------------------------------
// Cut polylines
// ---------------------------------------------------------------------------

function distinctPoints(cut: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of cut) {
    const q = out[out.length - 1];
    if (!q || q.x !== p.x || q.y !== p.y) out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** The stretch of the cut from one crossing to a later one. */
function cutBetween(cut: Point[], from: Crossing, to: Crossing): Point[] {
  const out = [from.pt];
  for (let v = Math.floor(from.s) + 1; v < to.s; v++) out.push(cut[v]);
  out.push(to.pt);
  return out;
}

/** Where segments p0→p1 and q0→q1 cross at a point interior to both, or null. */
function properCrossing(p0: Point, p1: Point, q0: Point, q1: Point): Point | null {
  const r = { x: p1.x - p0.x, y: p1.y - p0.y };
  const s = { x: q1.x - q0.x, y: q1.y - q0.y };
  const den = r.x * s.y - r.y * s.x;
  if (den === 0) return null;
  const qp = { x: q0.x - p0.x, y: q0.y - p0.y };
  const t = (qp.x * s.y - qp.y * s.x) / den;
  const u = (qp.x * r.y - qp.y * r.x) / den;
  const eps = 1e-9;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  return { x: p0.x + t * r.x, y: p0.y + t * r.y };
}

/** `run` with every closed loop cut out at the point where it crosses itself. */
function withoutLoops(run: Point[]): Point[] {
  const out = run.slice();
  for (let i = 0; i + 1 < out.length; i++) {
    for (let j = out.length - 2; j > i + 1; j--) {
      const x = properCrossing(out[i], out[i + 1], out[j], out[j + 1]);
      if (x) { out.splice(i + 1, j - i, x); break; }
    }
  }
  return out;
}

function polylinesCross(a: Point[], b: Point[]): boolean {
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      if (properCrossing(a[i], a[i + 1], b[j], b[j + 1])) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Segment math
// ---------------------------------------------------------------------------

function evalSeg(s: Seg, t: number): Point {
  const u = 1 - t;
  if (s.length === 2) return { x: u * s[0].x + t * s[1].x, y: u * s[0].y + t * s[1].y };
  if (s.length === 3) {
    const a = u * u, b = 2 * u * t, c = t * t;
    return { x: a * s[0].x + b * s[1].x + c * s[2].x, y: a * s[0].y + b * s[1].y + c * s[2].y };
  }
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return {
    x: a * s[0].x + b * s[1].x + c * s[2].x + d * s[3].x,
    y: a * s[0].y + b * s[1].y + c * s[2].y + d * s[3].y,
  };
}

function derivSeg(s: Seg, t: number): Point {
  const n = s.length - 1;
  const d: Seg = [];
  for (let i = 0; i < n; i++) d.push({ x: n * (s[i + 1].x - s[i].x), y: n * (s[i + 1].y - s[i].y) });
  return d.length === 1 ? d[0] : evalSeg(d, t);
}

function splitSeg(s: Seg, t: number): [Seg, Seg] {
  const pts = (c: ArrayLike<number>): Seg => {
    const out: Seg = [];
    for (let i = 0; i < c.length; i += 2) out.push({ x: c[i], y: c[i + 1] });
    return out;
  };
  if (s.length === 2) {
    const m = evalSeg(s, t);
    return [[s[0], m], [m, s[1]]];
  }
  if (s.length === 3) {
    const [l, r] = splitQuadraticAt(s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y, t);
    return [pts(l), pts(r)];
  }
  const [l, r] = splitCubicAt(s[0].x, s[0].y, s[1].x, s[1].y, s[2].x, s[2].y, s[3].x, s[3].y, t);
  return [pts(l), pts(r)];
}

/** The part of `s` between t0 and t1, with its ends snapped to the given points. */
function subSeg(s: Seg, t0: number, t1: number, p0: Point, p1: Point): Seg | null {
  if (t1 - t0 <= 0) return null;
  let out = s;
  if (t0 > 0) out = splitSeg(out, t0)[1];
  const u = (t1 - t0) / (1 - t0);
  if (u < 1) out = splitSeg(out, u)[0];
  out = out.slice();
  out[0] = p0;
  out[out.length - 1] = p1;
  return out;
}

const reverseContour = (c: Contour): Contour => c.map((s) => s.slice().reverse()).reverse();

/** Points along a contour for area and containment estimates. */
function sampleContour(c: Contour): number[] {
  const out: number[] = [];
  for (const s of c) {
    const n = s.length === 2 ? 1 : 16;
    for (let i = 0; i < n; i++) {
      const p = evalSeg(s, i / n);
      out.push(p.x, p.y);
    }
  }
  return out;
}

/** Signed area; positive when the fill lies to the left of the direction of travel. */
function signedArea(c: Contour): number {
  const pts = sampleContour(c);
  let a = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
  }
  return a / 2;
}

// ---------------------------------------------------------------------------
// Roots of a segment against a line
// ---------------------------------------------------------------------------

/** Bernstein coefficients of the signed distance cross(d, P − o) along `s`. */
function sideCoeffs(s: Seg, o: Point, d: Point): number[] {
  return s.map((p) => d.x * (p.y - o.y) - d.y * (p.x - o.x));
}

function bernstein(f: number[], t: number): number {
  const u = 1 - t;
  if (f.length === 2) return u * f[0] + t * f[1];
  if (f.length === 3) return u * u * f[0] + 2 * u * t * f[1] + t * t * f[2];
  return u * u * u * f[0] + 3 * u * u * t * f[1] + 3 * u * t * t * f[2] + t * t * t * f[3];
}

interface SignChange { t: number; before: number; after: number }

/**
 * Where the polynomial changes sign on [0, 1]. The interval is cut at the
 * derivative's roots so each piece is monotonic, then each sign change is
 * bisected. Tangencies have no sign change and are skipped. With
 * `zeroIsPositive` a zero counts as positive, so a change landing exactly on
 * an end is still seen once; otherwise zeros at the ends are left to the
 * caller.
 */
function signChanges(f: number[], zeroIsPositive: boolean): SignChange[] {
  const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : zeroIsPositive ? 1 : 0);
  const cuts = [0, ...criticalPoints(f), 1];
  const out: SignChange[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    let lo = cuts[i], hi = cuts[i + 1];
    const slo = sgn(bernstein(f, lo)), shi = sgn(bernstein(f, hi));
    if (slo === 0 && i > 0) {
      const before = sgn(bernstein(f, lo - 1e-7)), after = sgn(bernstein(f, lo + 1e-7));
      if (before * after < 0) out.push({ t: lo, before, after });
    }
    if (slo * shi >= 0) continue;
    for (let it = 0; it < 64; it++) {
      const mid = (lo + hi) / 2;
      if (sgn(bernstein(f, mid)) === slo) lo = mid; else hi = mid;
    }
    out.push({ t: (lo + hi) / 2, before: slo, after: shi });
  }
  return out;
}

/** Roots in (0, 1) of the derivative of a Bernstein polynomial of degree ≤ 3. */
function criticalPoints(f: number[]): number[] {
  if (f.length < 3) return [];
  const n = f.length - 1;
  const d = f.slice(1).map((v, i) => n * (v - f[i]));
  // Power basis of the derivative: A t² + B t + C.
  let A = 0, B: number, C: number;
  if (d.length === 2) { B = d[1] - d[0]; C = d[0]; }
  else { A = d[0] - 2 * d[1] + d[2]; B = 2 * (d[1] - d[0]); C = d[0]; }
  const out: number[] = [];
  const scale = Math.max(Math.abs(A), Math.abs(B), Math.abs(C)) || 1;
  if (Math.abs(A) / scale < 1e-12) {
    if (Math.abs(B) / scale > 1e-12) out.push(-C / B);
  } else {
    const disc = B * B - 4 * A * C;
    if (disc >= 0) {
      const q = -0.5 * (B + Math.sign(B || 1) * Math.sqrt(disc));
      out.push(q / A);
      if (q !== 0) out.push(C / q);
    }
  }
  return out.filter((t) => t > 0 && t < 1).sort((x, y) => x - y);
}

/** Sign of f just after t = 0 (`fromStart`) or just before t = 1, read off the control values. */
function endSide(f: number[], fromStart: boolean): number {
  const n = f.length;
  for (let i = 1; i < n; i++) {
    const v = fromStart ? f[i] : f[n - 1 - i];
    if (v !== 0) return Math.sign(v);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Contours
// ---------------------------------------------------------------------------

/** Closed contours of `path`. Open subpaths close implicitly, as a fill does. */
function parseContours(path: Path): Contour[] {
  return parseSubpaths(path).map((s) => s.segs);
}

interface Subpath {
  segs: Contour;
  /** Closed by a `Z` (or a rect); the closing edge, if any, is in `segs`. */
  closed: boolean;
}

/**
 * Subpaths of `path` with their segments. With `implicitClose` (the default,
 * as a fill sees them) every subpath ends in its closing edge; without it,
 * only a subpath closed by `Z` does, as a stroke sees them.
 */
function parseSubpaths(path: Path, implicitClose = true): Subpath[] {
  if (path.kind === 'rect') {
    const { x, y, width: w, height: h } = path;
    const p = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    return [{ segs: p.map((q, i) => [q, p[(i + 1) % 4]]), closed: true }];
  }
  const out: Subpath[] = [];
  let cur: Contour = [];
  let start: Point = { x: 0, y: 0 };
  let pen: Point = start;
  const finish = (closed: boolean) => {
    if (cur.length > 0 && (closed || implicitClose) && (pen.x !== start.x || pen.y !== start.y)) {
      cur.push([pen, start]);
    }
    if (cur.length > 0) out.push({ segs: cur, closed });
    cur = [];
    pen = start;
  };
  const c = path.coords;
  let k = 0;
  for (const cmd of path.commands) {
    if (cmd === PATH_M) {
      finish(false);
      start = pen = { x: c[k], y: c[k + 1] };
      k += 2;
    } else if (cmd === PATH_L) {
      const e = { x: c[k], y: c[k + 1] };
      if (e.x !== pen.x || e.y !== pen.y) cur.push([pen, e]);
      pen = e;
      k += 2;
    } else if (cmd === PATH_Q) {
      const e = { x: c[k + 2], y: c[k + 3] };
      cur.push([pen, { x: c[k], y: c[k + 1] }, e]);
      pen = e;
      k += 4;
    } else if (cmd === PATH_C) {
      const e = { x: c[k + 4], y: c[k + 5] };
      cur.push([pen, { x: c[k], y: c[k + 1] }, { x: c[k + 2], y: c[k + 3] }, e]);
      pen = e;
      k += 6;
    } else if (cmd === PATH_Z) {
      finish(true);
    }
  }
  finish(false);
  return out;
}

/** Whether any contour crosses another or itself, judged on a flattening. */
function contoursIntersect(contours: Contour[], tol: number): boolean {
  type Edge = { x0: number; y0: number; x1: number; y1: number; c: number; i: number; n: number };
  const edges: Edge[] = [];
  contours.forEach((contour, ci) => {
    const pts: Point[] = [];
    for (const s of contour) {
      let n = 1;
      if (s.length > 2) {
        let len = 0;
        for (let i = 0; i + 1 < s.length; i++) len += Math.hypot(s[i + 1].x - s[i].x, s[i + 1].y - s[i].y);
        n = Math.min(64, Math.max(2, Math.ceil(Math.sqrt(len / Math.max(tol, 1e-3)))));
      }
      for (let i = 0; i < n; i++) pts.push(evalSeg(s, i / n));
    }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      edges.push({ x0: p.x, y0: p.y, x1: q.x, y1: q.y, c: ci, i, n: pts.length });
    }
  });
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      const f = edges[j];
      if (e.c === f.c && (j - i === 1 || (i === 0 && f.i === f.n - 1))) continue;
      if (Math.max(e.x0, e.x1) < Math.min(f.x0, f.x1) || Math.max(f.x0, f.x1) < Math.min(e.x0, e.x1)) continue;
      if (Math.max(e.y0, e.y1) < Math.min(f.y0, f.y1) || Math.max(f.y0, f.y1) < Math.min(e.y0, e.y1)) continue;
      if (segmentsCross(e.x0, e.y0, e.x1, e.y1, f.x0, f.y0, f.x1, f.y1)) return true;
    }
  }
  return false;
}

/** Winding number of `q`, by a ray cast in +x against the exact curves. */
function windingAt(q: Point, contours: Contour[]): number {
  const dir = { x: 1, y: 0 };
  let w = 0;
  for (const contour of contours) {
    for (const s of contour) {
      for (const c of signChanges(sideCoeffs(s, q, dir), true)) {
        if (evalSeg(s, c.t).x > q.x) w += c.after > 0 ? 1 : -1;
      }
    }
  }
  return w;
}

/**
 * The contours that bound the fill, each turned so the fill lies on its left.
 * A contour with fill on both sides or neither (a same-direction inner ring
 * under nonzero) bounds nothing and is dropped.
 */
function orientBoundaries(contours: Contour[], fillRule: PathFillRule): Contour[] {
  const filled = (q: Point) => {
    const w = windingAt(q, contours);
    return fillRule === 'evenodd' ? (w & 1) !== 0 : w !== 0;
  };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of contours) for (const s of c) for (const p of s) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const eps = Math.max(Math.hypot(maxX - minX, maxY - minY) * 1e-6, 1e-9);

  const out: Contour[] = [];
  for (const contour of contours) {
    let probe = contour[0];
    let best = -1;
    for (const s of contour) {
      const len = Math.hypot(s[s.length - 1].x - s[0].x, s[s.length - 1].y - s[0].y);
      if (len > best) { best = len; probe = s; }
    }
    const p = evalSeg(probe, 0.5);
    let tan = derivSeg(probe, 0.5);
    const tl = Math.hypot(tan.x, tan.y);
    if (tl === 0) continue;
    tan = { x: tan.x / tl, y: tan.y / tl };
    const left = filled({ x: p.x - tan.y * eps, y: p.y + tan.x * eps });
    const right = filled({ x: p.x + tan.y * eps, y: p.y - tan.x * eps });
    if (left && !right) out.push(contour);
    else if (right && !left) out.push(reverseContour(contour));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Crossings and tracing
// ---------------------------------------------------------------------------

/**
 * Where along cut segment `k` of `cut` a point on its line falls, as a
 * position on the whole cut, or null when it is off that segment. A point at a
 * joint belongs to the segment that starts there, so it is counted once.
 */
function cutPosition(cut: Point[], k: number, pt: Point): number | null {
  const a = cut[k], b = cut[k + 1];
  const d = { x: b.x - a.x, y: b.y - a.y };
  const s = ((pt.x - a.x) * d.x + (pt.y - a.y) * d.y) / (d.x * d.x + d.y * d.y);
  const eps = 1e-9;
  const last = k + 2 === cut.length;
  if (s < (k === 0 ? 0 : -eps)) return null;
  if (last ? s > 1 : s >= 1 - eps) return null;
  return k + Math.min(1, Math.max(0, s));
}

/** Every point where the boundary crosses the cut, sorted along it. */
function findCrossings(boundaries: Contour[], cut: Point[]): Crossing[] {
  const out: Crossing[] = [];
  for (let k = 0; k + 1 < cut.length; k++) crossingsOnSegment(boundaries, cut, k, out);
  return out.sort((x, y) => x.s - y.s);
}

function crossingsOnSegment(boundaries: Contour[], cut: Point[], k: number, out: Crossing[]): void {
  const a = cut[k];
  const d = { x: cut[k + 1].x - a.x, y: cut[k + 1].y - a.y };
  const push = (contour: number, seg: number, t: number, before: number, after: number) => {
    const pt = evalSeg(boundaries[contour][seg], t);
    const s = cutPosition(cut, k, pt);
    if (s === null) return;
    // Fill is on the boundary's left: crossing from the cut's left to its right is an entry.
    out.push({ contour, seg, t, pt, s, enters: before > 0 && after < 0 });
  };

  boundaries.forEach((contour, ci) => {
    const fs = contour.map((s) => sideCoeffs(s, a, d));
    const n = contour.length;
    fs.forEach((f, si) => {
      for (const c of signChanges(f, false)) push(ci, si, c.t, c.before, c.after);
      if (f[0] !== 0) return;
      // The segment passes through this vertex. Where the boundary runs along
      // the cut, the crossing is taken at the end of the run.
      const after = endSide(f, true);
      if (after === 0) return;
      let before = 0;
      for (let k = 1; k <= n && before === 0; k++) before = endSide(fs[(si - k + n) % n], false);
      if (before !== 0 && before !== after) push(ci, si, 0, before, after);
    });
  });
}

/**
 * Walk the boundary arcs between cut points and the chords that join them.
 * With the fill on every contour's left, each arc ending at a cut point
 * continues along that point's chord and then along the arc leaving the
 * chord's other end.
 */
function traceLoops(
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
function arcBetween(contour: Contour, from: Station, to: Station, whole: boolean): Seg[] {
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

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Group loops into regions: each positive loop with the holes it immediately contains. */
function assembleRegions(outers: Contour[], holes: Contour[]): Contour[][] {
  const regions = outers.map((o) => ({ loops: [o], ring: sampleContour(o), area: signedArea(o) }));
  for (const h of holes) {
    const hp = evalSeg(h[0], 0.5);
    let best: (typeof regions)[number] | null = null;
    for (const r of regions) {
      if (pointInPolygon(r.ring, hp.x, hp.y) && (!best || r.area < best.area)) best = r;
    }
    best?.loops.push(h);
  }
  return regions.map((r) => r.loops);
}

const regionArea = (r: Contour[]): number => r.reduce((s, c) => s + signedArea(c), 0);

const toPath = (loops: Contour[], fillRule: PathFillRule): PolygonPath =>
  writePath(loops.map((segs) => ({ segs, closed: true })), fillRule);

function writePath(subpaths: Subpath[], fillRule: PathFillRule): PolygonPath {
  const cmds: number[] = [];
  const xs: number[] = [];
  for (const { segs, closed } of subpaths) {
    cmds.push(PATH_M);
    xs.push(segs[0][0].x, segs[0][0].y);
    for (const s of segs) {
      cmds.push(s.length === 2 ? PATH_L : s.length === 3 ? PATH_Q : PATH_C);
      for (let i = 1; i < s.length; i++) xs.push(s[i].x, s[i].y);
    }
    if (closed) cmds.push(PATH_Z);
  }
  return { kind: 'polygon', commands: new Uint8Array(cmds), coords: new Float32Array(xs), fillRule };
}
