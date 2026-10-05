/**
 * Clipping staged geometry to an axis-aligned rect on the CPU, so a rect clip
 * needs no stencil and does not break the run.
 *
 * A stencil clip is GL state, so content inside one cannot share a draw with
 * content outside it, and every clipped group paid a flush on the way in and
 * another on the way out. A rect under a transform that keeps it axis-aligned
 * is the common clip, and for that one the clip can ride the geometry instead:
 * cut each staged polygon to the rect before it joins the run.
 *
 * Exact, not approximate: every attribute a batch vertex carries is affine
 * across the polygon it belongs to, so interpolating along a cut edge gives
 * the value the rasterizer would have produced there, and the cut polygon
 * covers the same pixel centers the stencil would have passed.
 */

import type { Path } from '@weasel-js/geom';
import type { GlMat3 } from './math/mat3';

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
  // Four passes, ping-ponging so the last one lands in `dst`.
  let count = clipEdge(src, n, stride, 0, rect.x0, 1, tmp);
  count = clipEdge(tmp, count, stride, 0, rect.x1, -1, dst);
  count = clipEdge(dst, count, stride, 1, rect.y0, 1, tmp);
  return clipEdge(tmp, count, stride, 1, rect.y1, -1, dst);
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
      const a = prev * stride;
      const b = cur * stride;
      const t = (at - src[a + axis]) / (src[b + axis] - src[a + axis]);
      const o = m * stride;
      for (let k = 0; k < stride; k++) out[o + k] = src[a + k] + t * (src[b + k] - src[a + k]);
      // On the line exactly, whatever the interpolation rounded to.
      out[o + axis] = at;
      m++;
    }
    if (curIn) {
      const o = m * stride;
      const c = cur * stride;
      for (let k = 0; k < stride; k++) out[o + k] = src[c + k];
      m++;
    }
    prev = cur;
    prevIn = curIn;
  }
  return m;
}
