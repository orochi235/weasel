import { splitCubicAt, splitQuadraticAt, segmentsCross, pointInPolygon } from '@weasel-js/geom';
import type { Path, PolygonPath, PathFillRule } from './types';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from './types';
import type { Point } from './cubicMath';
import { pathUnion } from './booleans';

export type { Point };

/** Options for `splitPathBySegment`. */
export interface SplitBySegmentOptions {
  /**
   * Flattening tolerance for the check that decides whether contours cross
   * each other. Only a path whose contours do cross is flattened (see
   * `splitPathBySegment`).
   */
  flattenTolerance?: number;
}

/** A Bézier segment by its control points: 2 = line, 3 = quadratic, 4 = cubic. */
type Seg = Point[];
type Contour = Seg[];

interface Crossing {
  contour: number;
  seg: number;
  t: number;
  pt: Point;
  /** Position along the cut, 0 at `a` and 1 at `b`. */
  s: number;
  /** True where the cut, going from a to b, enters the filled region. */
  enters: boolean;
}

/**
 * Split `path` along the finite segment a→b into closed pieces (Knife).
 *
 * Only chords the segment crosses end to end are cut: a stretch of the segment
 * that starts or stops inside the fill cuts nothing, and nothing beyond the
 * segment's ends is touched, so a concave shape splits exactly where the
 * stroke crosses it. Curves are split at the crossing parameters by de
 * Casteljau subdivision, so every piece traces the original boundary exactly
 * and keeps its quadratic and cubic segments; the new edges along the cut are
 * straight lines.
 *
 * Each connected piece the cut produces is returned as its own path, holes
 * included. Contours the segment misses entirely are returned together as one
 * final piece. A single chord that does not disconnect the shape (across a
 * ring, say) returns one slit piece.
 *
 * A path whose contours cross each other or themselves is first resolved into
 * non-overlapping rings by a polygon union, which flattens its curves.
 *
 * Returns `null` when no chord is cut.
 */
export function splitPathBySegment(
  path: Path,
  a: Point,
  b: Point,
  opts: SplitBySegmentOptions = {},
): Path[] | null {
  if (a.x === b.x && a.y === b.y) return null;
  const outRule: PathFillRule = path.kind === 'polygon' ? path.fillRule : 'nonzero';

  let contours = parseContours(path);
  let fillRule = outRule;
  if (contoursIntersect(contours, opts.flattenTolerance ?? 0.5)) {
    contours = parseContours(pathUnion(path));
    fillRule = 'nonzero';
  }

  const boundaries = orientBoundaries(contours, fillRule);
  if (boundaries.length === 0) return null;

  const crossings = findCrossings(boundaries, a, b);
  const partner = new Map<Crossing, Crossing>();
  for (let k = 0; k + 1 < crossings.length; k++) {
    const c0 = crossings[k], c1 = crossings[k + 1];
    if (c0.enters && !c1.enters && c1.s - c0.s > 1e-9) {
      partner.set(c0, c1);
      partner.set(c1, c0);
    }
  }
  if (partner.size === 0) return null;

  const { loops, untouched } = traceLoops(boundaries, partner);

  const traced = assembleRegions(loops, untouched.filter((c) => signedArea(c) < 0));
  const islands = untouched.filter((c) => signedArea(c) > 0);
  const pieces: Contour[][] = traced.filter((r) => Math.abs(regionArea(r)) > 1e-6);
  if (islands.length > 0) {
    const leftover = untouched.filter((c) => !traced.some((r) => r.includes(c)));
    pieces.push(leftover);
  }
  return pieces.map((r) => toPath(r, outRule));
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
  if (path.kind === 'rect') {
    const { x, y, width: w, height: h } = path;
    const p = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    return [p.map((q, i) => [q, p[(i + 1) % 4]])];
  }
  const out: Contour[] = [];
  let cur: Contour = [];
  let start: Point = { x: 0, y: 0 };
  let pen: Point = start;
  const finish = () => {
    if (cur.length > 0 && (pen.x !== start.x || pen.y !== start.y)) cur.push([pen, start]);
    if (cur.length > 0) out.push(cur);
    cur = [];
    pen = start;
  };
  const c = path.coords;
  let k = 0;
  for (const cmd of path.commands) {
    if (cmd === PATH_M) {
      finish();
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
      finish();
    }
  }
  finish();
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

/** Every point where the boundary crosses the segment a→b, sorted from a. */
function findCrossings(boundaries: Contour[], a: Point, b: Point): Crossing[] {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const dd = d.x * d.x + d.y * d.y;
  const out: Crossing[] = [];
  const push = (contour: number, seg: number, t: number, before: number, after: number) => {
    const pt = evalSeg(boundaries[contour][seg], t);
    const s = ((pt.x - a.x) * d.x + (pt.y - a.y) * d.y) / dd;
    if (s < 0 || s > 1) return;
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
  return out.sort((x, y) => x.s - y.s);
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
      const other = partner.get(arc.end)!;
      loop.push([arc.end.pt, other.pt]);
      at = other;
    }
    loops.push(loop);
  }
  return { loops, untouched };
}

/** The boundary from one cut point forward to the next. */
function arcBetween(contour: Contour, from: Crossing, to: Crossing, whole: boolean): Seg[] {
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

function toPath(loops: Contour[], fillRule: PathFillRule): PolygonPath {
  const cmds: number[] = [];
  const xs: number[] = [];
  for (const loop of loops) {
    cmds.push(PATH_M);
    xs.push(loop[0][0].x, loop[0][0].y);
    for (const s of loop) {
      cmds.push(s.length === 2 ? PATH_L : s.length === 3 ? PATH_Q : PATH_C);
      for (let i = 1; i < s.length; i++) xs.push(s[i].x, s[i].y);
    }
    cmds.push(PATH_Z);
  }
  return { kind: 'polygon', commands: new Uint8Array(cmds), coords: new Float32Array(xs), fillRule };
}
