/**
 * Clipping staged geometry on the CPU, so a rect clip, and on a target where
 * the batch shader cannot decide hulls a convex one, needs no stencil and does
 * not break the run.
 *
 * A stencil clip is GL state, so content inside one cannot share a draw with
 * content outside it. A rect under a transform that keeps it axis-aligned
 * is the common clip, and for that one the clip can ride the geometry instead:
 * cut each staged polygon to the rect before it joins the run.
 *
 * Exact, not approximate: every attribute a batch vertex carries is affine
 * across the polygon it belongs to, so interpolating along a cut edge gives
 * the value the rasterizer would have produced there, and the cut polygon
 * covers the same pixel centers the stencil would have passed.
 *
 * **Except where an edge is slanted.** A cut point on a slanted edge, the
 * item's or the clip's, is not a point the rasterizer can hold, so it lands up
 * to half a subpixel off the line, and samples that close to the line can go
 * the other way. Where the batch shader decides hulls exactly (`batchHull.ts`)
 * a slanted cut is refused and the item goes there instead. Elsewhere, on a
 * multisampled target, a retained surface or an effect's target, the cut is
 * taken (`BatchCut.slanted`): a sample flipped at a clip's edge against a
 * stencil break per clip. Interpolation runs from the same end of an edge
 * whichever polygon is cut along it, so two triangles sharing an edge are cut
 * at the same point and stay watertight.
 */

import type { Path, GlMat3 } from '@weasel-js/geom';
import { cornersOf, dropCollinear, isConvex, reverse, signedArea } from './batchHull';

/** In the space batch vertices are staged in: after the model transform,
 *  before the projection. */
export interface ClipRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * `path` under `m` as a `ClipRect`, or `null` when it is not one: not a rect
 * path, or a transform that rotates or skews it off the axes.
 */
export function axisAlignedClipRect(path: Path, m: GlMat3): ClipRect | null {
  if (path.kind !== 'rect') return null;
  const keepsAxes = (m[1] === 0 && m[3] === 0) || (m[0] === 0 && m[4] === 0);
  if (!keepsAxes) return null;
  const ax = m[0] * path.x + m[3] * path.y + m[6];
  const ay = m[1] * path.x + m[4] * path.y + m[7];
  const x1 = path.x + path.width;
  const y1 = path.y + path.height;
  const bx = m[0] * x1 + m[3] * y1 + m[6];
  const by = m[1] * x1 + m[4] * y1 + m[7];
  return {
    x0: Math.min(ax, bx), y0: Math.min(ay, by),
    x1: Math.max(ax, bx), y1: Math.max(ay, by),
  };
}

export function intersectClipRects(a: ClipRect, b: ClipRect): ClipRect {
  return {
    x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1),
  };
}

/** Half-planes a run's geometry may be cut against, all clips' together. */
export const MAX_CUT_PLANES = 16;

/** Half-planes one convex clip may bring. */
const MAX_CLIP_PLANES = 8;

/** What staged geometry is cut to: a rect, half-planes, or both. */
export interface BatchCut {
  readonly rect: ClipRect | null;
  /** `a, b, c` for each half-plane, kept where `a * x + b * y + c >= 0`, in
   *  the space batch vertices are staged in. */
  readonly planes: Float64Array;
  /** Whether a slanted edge may be cut, rather than the item refused. */
  readonly slanted: boolean;
}

const NO_PLANES = new Float64Array(0);

/** `rect` and `planes` as one cut, or `null` when there is nothing to cut to. */
export function batchCut(rect: ClipRect | null, planes: readonly Float64Array[], slanted: boolean): BatchCut | null {
  if (rect === null && planes.length === 0) return null;
  let all: Float64Array = NO_PLANES;
  if (planes.length === 1) all = planes[0];
  else if (planes.length > 1) {
    all = new Float64Array(planes.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of planes) { all.set(p, at); at += p.length; }
  }
  return { rect, planes: all, slanted };
}

const lastPlanes = new WeakMap<Path, { m: Float64Array; planes: Float64Array | null }>();

/**
 * `path` under `m` as the half-planes bounding it, in the space batch vertices
 * are staged in, or `null` when it is not a convex polygon of at most eight
 * straight edges. Kept per path while `m` holds.
 */
export function convexCutPlanes(path: Path, m: GlMat3): Float64Array | null {
  const last = lastPlanes.get(path);
  if (last !== undefined && last.m[0] === m[0] && last.m[1] === m[1] && last.m[2] === m[3]
      && last.m[3] === m[4] && last.m[4] === m[6] && last.m[5] === m[7]) return last.planes;
  const planes = buildPlanes(path, m);
  lastPlanes.set(path, { m: Float64Array.of(m[0], m[1], m[3], m[4], m[6], m[7]), planes });
  return planes;
}

function buildPlanes(path: Path, m: GlMat3): Float64Array | null {
  const local = cornersOf(path);
  if (local === null) return null;
  const pts: number[] = [];
  for (let i = 0; i < local.length; i += 2) {
    pts.push(m[0] * local[i] + m[3] * local[i + 1] + m[6], m[1] * local[i] + m[4] * local[i + 1] + m[7]);
  }
  return ringPlanes(pts, MAX_CLIP_PLANES);
}

/**
 * The closed ring `pts` (x, y pairs, either winding) as the half-planes of
 * its edges, each keeping the inside, or `null` when it is not convex, has no
 * area, or has more than `max` edges once collinear corners are dropped.
 */
export function ringPlanes(ring: readonly number[], max: number): Float64Array | null {
  const pts: number[] = [];
  for (let i = 0; i < ring.length; i += 2) {
    const n = pts.length;
    if (n >= 2 && pts[n - 2] === ring[i] && pts[n - 1] === ring[i + 1]) continue;
    pts.push(ring[i], ring[i + 1]);
  }
  while (pts.length >= 4 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) pts.length -= 2;
  if (pts.length < 6) return null;
  if (signedArea(pts) < 0) reverse(pts);
  const kept = dropCollinear(pts);
  if (kept.length < 6 || kept.length / 2 > max || !isConvex(kept)) return null;
  const n = kept.length / 2;
  const out = new Float64Array(n * 3);
  for (let k = 0; k < n; k++) {
    const px = kept[k * 2], py = kept[k * 2 + 1];
    const qx = kept[((k + 1) % n) * 2], qy = kept[((k + 1) % n) * 2 + 1];
    const len = Math.hypot(qx - px, qy - py);
    const a = -(qy - py) / len, b = (qx - px) / len;
    out[k * 3] = a; out[k * 3 + 1] = b; out[k * 3 + 2] = -(a * px + b * py);
  }
  return out;
}

/** Whether the point `(x, y)` is kept by `cut`. */
export function cutKeeps(cut: BatchCut, x: number, y: number): boolean {
  const r = cut.rect;
  if (r !== null && (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1)) return false;
  const p = cut.planes;
  for (let k = 0; k < p.length; k += 3) if (p[k] * x + p[k + 1] * y + p[k + 2] < 0) return false;
  return true;
}

/**
 * Whether every one of the `n` points in `src` (each `stride` floats from
 * `from`) lies outside one and the same edge of `cut`, so nothing of their
 * hull is kept.
 */
export function cutMisses(cut: BatchCut, src: Float32Array, from: number, n: number, stride: number): boolean {
  const r = cut.rect;
  if (r !== null) {
    let left = true, right = true, below = true, above = true;
    for (let i = 0, o = from; i < n; i++, o += stride) {
      const x = src[o], y = src[o + 1];
      left &&= x <= r.x0; right &&= x >= r.x1; below &&= y <= r.y0; above &&= y >= r.y1;
    }
    if (left || right || below || above) return true;
  }
  const p = cut.planes;
  for (let k = 0; k < p.length; k += 3) {
    let out = true;
    for (let i = 0, o = from; i < n && out; i++, o += stride) out = p[k] * src[o] + p[k + 1] * src[o + 1] + p[k + 2] <= 0;
    if (out) return true;
  }
  return false;
}

/**
 * Cut the convex polygon of `n` vertices in `src` (each `stride` floats, x and
 * y first) to `rect`, writing the result to `dst`. Returns the vertex count,
 * which is below 3 when nothing is left. `tmp` must hold as many floats as
 * `dst`; both need room for `n + 4` vertices.
 */
export function clipConvexPolygon(
  src: Float32Array, n: number, stride: number, rect: ClipRect,
  dst: Float32Array, tmp: Float32Array,
): number {
  return cutConvexPolygon(src, n, stride, { rect, planes: NO_PLANES, slanted: false }, dst, tmp);
}

/** {@link clipConvexPolygon} to a whole `cut`; `dst` and `tmp` need room for
 *  `n` more vertices than there are edges in it. */
export function cutConvexPolygon(
  src: Float32Array, n: number, stride: number, cut: BatchCut,
  dst: Float32Array, tmp: Float32Array,
): number {
  const r = cut.rect;
  const p = cut.planes;
  const edges = r === null ? 0 : 4;
  const passes = edges + p.length / 3;
  if (passes === 0) {
    dst.set(src.subarray(0, n * stride));
    return n;
  }
  // Ping-pong so the last pass lands in `dst`.
  let from = src;
  let to = passes % 2 === 0 ? tmp : dst;
  let count = n;
  for (let pass = 0; pass < passes; pass++) {
    if (pass < edges) {
      const axis = pass < 2 ? 0 : 1;
      const at = pass === 0 ? r!.x0 : pass === 1 ? r!.x1 : pass === 2 ? r!.y0 : r!.y1;
      count = clipEdge(from, count, stride, axis, at, pass % 2 === 0 ? 1 : -1, to);
    } else {
      const k = (pass - edges) * 3;
      count = clipPlane(from, count, stride, p[k], p[k + 1], p[k + 2], to);
    }
    from = to;
    to = to === dst ? tmp : dst;
  }
  return count;
}

/** One Sutherland–Hodgman pass: keep the side of `axis = at` where
 *  `sign * (v - at) >= 0`. */
function clipEdge(
  src: Float32Array, n: number, stride: number,
  axis: 0 | 1, at: number, sign: 1 | -1, out: Float32Array,
): number {
  if (n === 0) return 0;
  let m = 0;
  let prev = n - 1;
  let prevIn = sign * (src[prev * stride + axis] - at) >= 0;
  for (let cur = 0; cur < n; cur++) {
    const curIn = sign * (src[cur * stride + axis] - at) >= 0;
    if (curIn !== prevIn) {
      const [a, b] = canonical(src, prev * stride, cur * stride);
      const t = (at - src[a + axis]) / (src[b + axis] - src[a + axis]);
      lerpInto(src, a, b, t, stride, out, m * stride);
      // On the line exactly, whatever the interpolation rounded to.
      out[m * stride + axis] = at;
      m++;
    }
    if (curIn) {
      out.set(src.subarray(cur * stride, cur * stride + stride), m * stride);
      m++;
    }
    prev = cur;
    prevIn = curIn;
  }
  return m;
}

/** One Sutherland–Hodgman pass against the half-plane `a x + b y + c >= 0`,
 *  `n` vertices of `stride` floats from `src` into `out`. */
export function clipPlane(
  src: Float32Array, n: number, stride: number,
  pa: number, pb: number, pc: number, out: Float32Array,
): number {
  if (n === 0) return 0;
  let m = 0;
  let prev = n - 1;
  let prevIn = pa * src[prev * stride] + pb * src[prev * stride + 1] + pc >= 0;
  for (let cur = 0; cur < n; cur++) {
    const o = cur * stride;
    const curIn = pa * src[o] + pb * src[o + 1] + pc >= 0;
    if (curIn !== prevIn) {
      const [a, b] = canonical(src, prev * stride, o);
      const da = pa * src[a] + pb * src[a + 1] + pc, db = pa * src[b] + pb * src[b + 1] + pc;
      lerpInto(src, a, b, da / (da - db), stride, out, m * stride);
      m++;
    }
    if (curIn) {
      out.set(src.subarray(cur * stride, cur * stride + stride), m * stride);
      m++;
    }
    prev = cur;
    prevIn = curIn;
  }
  return m;
}

const PAIR: [number, number] = [0, 0];

/** The ends of an edge in one order however it is walked: smaller x first,
 *  then smaller y, so polygons sharing it interpolate the same cut point. */
function canonical(src: Float32Array, i: number, j: number): [number, number] {
  const swap = src[j] < src[i] || (src[j] === src[i] && src[j + 1] < src[i + 1]);
  PAIR[0] = swap ? j : i;
  PAIR[1] = swap ? i : j;
  return PAIR;
}

function lerpInto(src: Float32Array, a: number, b: number, t: number, stride: number, out: Float32Array, o: number): void {
  for (let k = 0; k < stride; k++) out[o + k] = src[a + k] + t * (src[b + k] - src[a + k]);
}
