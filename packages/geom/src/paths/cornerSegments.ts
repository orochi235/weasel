/**
 * A path decoded into contours of anchors and the exact segments between
 * them, for corner expansion: lines stay lines, a quadratic is elevated to
 * the cubic it equals, and a closing curve that ends on its subpath's first
 * point folds onto that anchor the way `enumerateAnchors` counts it.
 */
import { forEachSegment, PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from '../commands';
import { cubicEvalAt, splitCubicAt } from '../curve';
import type { PolygonPath } from '../path';
import type { Point } from './cubicMath';
import { worldCoords } from './pathOrigin';

/** One segment as a cubic; a line has its controls on its ends. */
export interface Seg {
  line: boolean;
  p0: Point; c1: Point; c2: Point; p3: Point;
}

/** One subpath. Segment `k` runs from anchor `k` to anchor `k + 1`, wrapping
 *  when closed, so a closed contour has as many segments as anchors. */
export interface Contour {
  anchors: Point[];
  segs: Seg[];
  closed: boolean;
  /** Flat index of `anchors[0]`. */
  first: number;
  /** For each anchor, the index of the command that drew it among the
   *  path's M, L, C, and Q commands: the numbering `countPathAnchors` sizes
   *  per-anchor arrays by. */
  sources: number[];
}

const lineSeg = (a: Point, b: Point): Seg => ({ line: true, p0: a, c1: a, c2: b, p3: b });

/** `path` as contours, or null when a command opens a subpath with no `M`,
 *  where the anchor walkers and this one would count differently. */
export function decodeContours(path: PolygonPath): Contour[] | null {
  const { commands } = path;
  const coords = worldCoords(path);
  const out: Contour[] = [];
  let cur: Contour | null = null;
  let flat = 0;
  let drawn = 0;
  let bad = false;
  const last = (): Point => cur!.anchors[cur!.anchors.length - 1];
  const push = (p: Point, seg: Seg): void => {
    cur!.segs.push(seg);
    cur!.anchors.push(p);
    cur!.sources.push(drawn++);
    flat++;
  };
  forEachSegment(commands, coords, (cmd, ci, _px, _py, _i, opens) => {
    if (opens) { bad = true; return false; }
    const at = (k: number): Point => ({ x: coords[ci + k], y: coords[ci + k + 1] });
    switch (cmd) {
      case PATH_M:
        if (cur) out.push(cur);
        cur = { anchors: [at(0)], segs: [], closed: false, first: flat++, sources: [drawn++] };
        break;
      case PATH_L:
        push(at(0), lineSeg(last(), at(0)));
        break;
      case PATH_C:
        push(at(4), { line: false, p0: last(), c1: at(0), c2: at(2), p3: at(4) });
        break;
      case PATH_Q: {
        const p0 = last(), q = at(0), p3 = at(2);
        const c1 = { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) };
        const c2 = { x: p3.x + (2 / 3) * (q.x - p3.x), y: p3.y + (2 / 3) * (q.y - p3.y) };
        push(p3, { line: false, p0, c1, c2, p3 });
        break;
      }
      case PATH_Z:
        if (cur) closeContour(cur, () => flat--);
        if (cur) out.push(cur);
        cur = null;
        break;
    }
    return undefined;
  });
  if (bad) return null;
  if (cur) out.push(cur);
  return out;
}

function closeContour(c: Contour, unfold: () => void): void {
  c.closed = true;
  const n = c.anchors.length;
  const a0 = c.anchors[0];
  const end = c.anchors[n - 1];
  if (n > 1 && !c.segs[n - 2].line && end.x === a0.x && end.y === a0.y) {
    c.anchors.pop();
    c.sources.pop();
    unfold();
    return;
  }
  c.segs.push(lineSeg(end, a0));
}

const LUT_STEPS = 32;

/** Arc length of `seg`. */
export function segLength(seg: Seg): number {
  if (seg.line) return Math.hypot(seg.p3.x - seg.p0.x, seg.p3.y - seg.p0.y);
  return lut(seg)[LUT_STEPS];
}

const lutCache = new WeakMap<Seg, Float64Array>();

function lut(seg: Seg): Float64Array {
  let table = lutCache.get(seg);
  if (table) return table;
  table = new Float64Array(LUT_STEPS + 1);
  let prev = seg.p0;
  for (let i = 1; i <= LUT_STEPS; i++) {
    const p = pointAt(seg, i / LUT_STEPS);
    table[i] = table[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  lutCache.set(seg, table);
  return table;
}

/** Parameter of the point `s` along `seg` from its start. */
export function paramAtLength(seg: Seg, s: number): number {
  const total = segLength(seg);
  if (total <= 0) return 0;
  if (seg.line) return Math.min(1, Math.max(0, s / total));
  const table = lut(seg);
  if (s <= 0) return 0;
  if (s >= total) return 1;
  let i = 1;
  while (table[i] < s) i++;
  const span = table[i] - table[i - 1];
  const f = span > 0 ? (s - table[i - 1]) / span : 0;
  return (i - 1 + f) / LUT_STEPS;
}

export function pointAt(seg: Seg, t: number): Point {
  if (seg.line) {
    return { x: seg.p0.x + (seg.p3.x - seg.p0.x) * t, y: seg.p0.y + (seg.p3.y - seg.p0.y) * t };
  }
  const { p0, c1, c2, p3 } = seg;
  const [x, y] = cubicEvalAt(p0.x, p0.y, c1.x, c1.y, c2.x, c2.y, p3.x, p3.y, t);
  return { x, y };
}

function unit(x: number, y: number): Point | null {
  const l = Math.hypot(x, y);
  return l > 1e-12 ? { x: x / l, y: y / l } : null;
}

/** Unit direction of travel along `seg` at `t`, or null for a segment of no length. */
export function tangentAt(seg: Seg, t: number): Point | null {
  const { p0, c1, c2, p3 } = seg;
  if (seg.line) return unit(p3.x - p0.x, p3.y - p0.y);
  const u = 1 - t;
  const dx = 3 * (u * u * (c1.x - p0.x) + 2 * u * t * (c2.x - c1.x) + t * t * (p3.x - c2.x));
  const dy = 3 * (u * u * (c1.y - p0.y) + 2 * u * t * (c2.y - c1.y) + t * t * (p3.y - c2.y));
  const d = unit(dx, dy);
  if (d) return d;
  // A control on its end point: the tangent there runs to the next point.
  if (t < 0.5) return unit(c2.x - p0.x, c2.y - p0.y) ?? unit(p3.x - p0.x, p3.y - p0.y);
  return unit(p3.x - c1.x, p3.y - c1.y) ?? unit(p3.x - p0.x, p3.y - p0.y);
}

/** The piece of cubic `seg` between parameters `t0 < t1`, as `[c1, c2, p3]`. */
export function subCubic(seg: Seg, t0: number, t1: number): [Point, Point, Point] {
  const { p0, c1, c2, p3 } = seg;
  let c = [p0.x, p0.y, c1.x, c1.y, c2.x, c2.y, p3.x, p3.y];
  if (t0 > 0) c = [...splitCubicAt(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], t0)[1]];
  const t = t0 < 1 ? (t1 - t0) / (1 - t0) : 1;
  if (t < 1) c = [...splitCubicAt(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], t)[0]];
  return [{ x: c[2], y: c[3] }, { x: c[4], y: c[5] }, { x: c[6], y: c[7] }];
}
