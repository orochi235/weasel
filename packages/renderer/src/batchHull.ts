/**
 * Convex clips decided per fragment in the batch shader, so a turned rect or a
 * convex polygon does not break the run the way a stencil clip does.
 *
 * **Exact, and only offered where it can be.** A clip goes in as half-planes
 * through its corners, snapped to a sixteenth of a device pixel: the coarsest
 * grid GL ES lets a rasterizer use (`SUBPIXEL_BITS` is at least 4), so every
 * snapped corner is a point the rasterizer can hold exactly. The fragment
 * tests its pixel center against them in integers, ties going the way the
 * rasterizer sends them, and the stencil, when something that draws for itself
 * needs one, is drawn from the same snapped corners. So the two agree pixel
 * for pixel. That holds on a target with one sample a pixel only: WebGL2 has
 * no `gl_SampleMask`, so a fragment cannot keep some of its samples and drop
 * the rest, and scaling its alpha by the samples covered instead leaves the
 * color underneath showing through at the clip's edge wherever two layers
 * stack inside it. A multisampled target keeps the stencil.
 *
 * The tie rule and the sample grid were read in a browser, headless Chromium
 * over SwiftShader and over ANGLE Metal (Apple M1 Max), 2026-10-27: an edge
 * through a pixel center covers it when the inside lies toward +x, or toward
 * +y along a horizontal edge, in GL's window space.
 */

import type { GlMat3, Path } from '@weasel-js/geom';
import { PATH_L, PATH_M, PATH_Z, polygonFromPoints } from '@weasel-js/geom';
import type { ClipRect } from './batchClip';

/** Half-planes one set of clips can hold, nested clips' together once
 *  planes facing the same way are merged (`meetHulls`). */
export const HULL_PLANES = 8;

/** Half-planes one run can hold across all its sets: the length of the
 *  shader's `u_hullPlanes`. */
export const HULL_POOL = 64;

/** Snap grid, in units a device pixel. */
export const HULL_UNITS = 16;
const UNITS = HULL_UNITS;
/** A corner further out than this many units is not taken: past it the
 *  shader's integer products could overflow. */
const MAX_UNITS = 2 ** 24;
/** Each plane's origin pixel is stored biased by this into 15 bits a axis. */
export const HULL_ORIGIN_BIAS = 16384;
export const HULL_ORIGIN_SPAN = 32768;
const ORIGIN_BIAS = HULL_ORIGIN_BIAS;
const ORIGIN_SPAN = HULL_ORIGIN_SPAN;

/**
 * Clips the shader tests a fragment against, as `count` half-planes of four
 * ints each, `(A, B, C, origin)`: a pixel is inside one when
 * `A * (X - 16 ox) + B * (Y - 16 oy) + C >= 0`, with `(X, Y)` its center in
 * sixteenths of a pixel from the window's bottom left and `(ox, oy)` the
 * origin pixel packed into the fourth int.
 */
export interface HullSet {
  readonly planes: Int32Array;
  readonly count: number;
}

/** One clip as half-planes, and the snapped polygon a stencil draws for it,
 *  in screen space at identity. */
export interface Hull {
  readonly set: HullSet;
  readonly path: Path;
}

/** Screen space to device pixels from the window's bottom left:
 *  `x = ax * sx + bx * sy + cx`, and the same for `y`. */
export interface WindowMap {
  ax: number; bx: number; cx: number;
  ay: number; by: number; cy: number;
  /** The viewport's center, where every fragment lands near. */
  midX: number; midY: number;
}

/**
 * The map a draw under `proj` (as `u_proj` holds it) goes through, into a
 * viewport of `width × height` device pixels whose corner is `origin`.
 */
export function windowMap(
  proj: GlMat3, origin: readonly [number, number], width: number, height: number,
): WindowMap {
  const hw = width / 2;
  const hh = height / 2;
  return {
    ax: proj[0] * hw, bx: proj[3] * hw, cx: (proj[6] + 1) * hw + origin[0],
    ay: proj[1] * hh, by: proj[4] * hh, cy: (proj[7] + 1) * hh + origin[1],
    midX: origin[0] + hw, midY: origin[1] + hh,
  };
}

/** The last hull built for each clip path, with what it was built under. */
const built = new WeakMap<Path, { m: Float64Array; map: WindowMap; hull: Hull | null }>();

/**
 * `path` under `m` as a hull, or `null` when it is not a convex polygon of at
 * most `HULL_PLANES` straight edges once snapped, or reaches too far.
 *
 * Kept per path while `m` and `map` hold, so a clip that stays put across
 * frames is built once and its stencil polygon keeps one mesh.
 */
export function hullOf(path: Path, m: GlMat3, map: WindowMap): Hull | null {
  const last = built.get(path);
  if (last !== undefined && sameTransform(last.m, m) && sameMap(last.map, map)) return last.hull;
  const hull = buildHull(path, m, map);
  built.set(path, { m: Float64Array.of(m[0], m[1], m[3], m[4], m[6], m[7]), map, hull });
  return hull;
}

/** A rect clip on the hull grid: the rect staged geometry is cut to, and the
 *  same rect as a hull, for an item the cut refuses. */
export interface SnappedRect {
  readonly rect: ClipRect;
  readonly hull: Hull;
}

const snappedRects = new WeakMap<Hull, SnappedRect>();

/**
 * An axis-aligned rect clip snapped to the grid `hullOf` uses, or `null` where
 * `map` turns the axes. The cut edges and the half-planes then run through the
 * same points, so an item cut on the CPU and one tested in the shader keep the
 * same pixels.
 */
export function snappedRectOf(path: Path, m: GlMat3, map: WindowMap): SnappedRect | null {
  if (map.bx !== 0 || map.ay !== 0) return null;
  const hull = hullOf(path, m, map);
  if (hull === null) return null;
  let snapped = snappedRects.get(hull);
  if (snapped === undefined) {
    snapped = { rect: boundsOf(hull.path), hull };
    snappedRects.set(hull, snapped);
  }
  return snapped;
}

function boundsOf(path: Path): ClipRect {
  if (path.kind === 'rect') {
    return { x0: path.x, y0: path.y, x1: path.x + path.width, y1: path.y + path.height };
  }
  const ox = path.origin?.x ?? 0;
  const oy = path.origin?.y ?? 0;
  const c = path.coords;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < c.length; i += 2) {
    const x = c[i] + ox;
    const y = c[i + 1] + oy;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

function sameTransform(a: Float64Array, m: GlMat3): boolean {
  return a[0] === m[0] && a[1] === m[1] && a[2] === m[3] && a[3] === m[4] && a[4] === m[6] && a[5] === m[7];
}

function sameMap(a: WindowMap, b: WindowMap): boolean {
  return a.ax === b.ax && a.bx === b.bx && a.cx === b.cx && a.ay === b.ay && a.by === b.by
    && a.cy === b.cy && a.midX === b.midX && a.midY === b.midY;
}

function buildHull(path: Path, m: GlMat3, map: WindowMap): Hull | null {
  const local = cornersOf(path);
  if (local === null || local.length < 3 * 2) return null;
  const pts: number[] = [];
  for (let i = 0; i < local.length; i += 2) {
    const sx = m[0] * local[i] + m[3] * local[i + 1] + m[6];
    const sy = m[1] * local[i] + m[4] * local[i + 1] + m[7];
    const wx = Math.round((map.ax * sx + map.bx * sy + map.cx) * UNITS);
    const wy = Math.round((map.ay * sx + map.by * sy + map.cy) * UNITS);
    if (!(Math.abs(wx) < MAX_UNITS && Math.abs(wy) < MAX_UNITS)) return null;
    const n = pts.length;
    if (n >= 2 && pts[n - 2] === wx && pts[n - 1] === wy) continue;
    pts.push(wx, wy);
  }
  while (pts.length >= 4 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) {
    pts.length -= 2;
  }
  if (signedArea(pts) < 0) reverse(pts);
  const kept = dropCollinear(pts);
  const stencil = screenPolygon(kept.length >= 6 ? kept : pts, map);
  if (kept.length < 6) return { set: EMPTY, path: stencil };
  if (kept.length / 2 > HULL_PLANES || !isConvex(kept)) return null;
  return { set: planesOf(kept, map), path: stencil };
}

/** A clip that covers nothing: snapped to a sliver, or to a point. */
const EMPTY: HullSet = { planes: Int32Array.of(0, 0, -1, packOrigin(0, 0)), count: 1 };

/** A clip that keeps every pixel: what is left once every plane is. */
const ALL: HullSet = { planes: Int32Array.of(0, 0, 0, packOrigin(0, 0)), count: 1 };

/**
 * `a` and `b` as one set, or `null` past `HULL_PLANES`. Of two planes facing
 * the same way only the tighter is kept, so nested rect clips, or clips turned
 * alike, stay at four planes however deep they go.
 */
export function meetHulls(a: HullSet, b: HullSet): HullSet | null {
  const out: number[] = [];
  for (const set of [a, b]) {
    for (let k = 0; k < set.count; k++) {
      const p = set.planes.subarray(4 * k, 4 * k + 4);
      if (p[0] === 0 && p[1] === 0) {
        if (p[2] < 0) return EMPTY;
        continue;
      }
      const j = sameFacing(out, p[0], p[1]);
      if (j < 0) out.push(p[0], p[1], p[2], p[3]);
      else if (threshold(p, 0) > threshold(out, j)) out.splice(j, 4, p[0], p[1], p[2], p[3]);
    }
  }
  if (out.length === 0) return ALL;
  if (out.length / 4 > HULL_PLANES) return null;
  return { planes: Int32Array.from(out), count: out.length / 4 };
}

/** The offset of the plane in `planes` whose normal points along `(a, b)`, or -1. */
function sameFacing(planes: ArrayLike<number>, a: number, b: number): number {
  for (let j = 0; j < planes.length; j += 4) {
    const pa = planes[j], pb = planes[j + 1];
    if (pa * b === pb * a && pa * a + pb * b > 0) return j;
  }
  return -1;
}

/**
 * The plane at `j` as `n . (X, Y) >= T`, `n` its normal reduced to lowest
 * terms: `T`, an integer, since every pixel center is. Two planes facing the
 * same way share `n`, and the larger `T` is the tighter. Exact: every product
 * here stays under 2^53.
 */
function threshold(planes: ArrayLike<number>, j: number): number {
  const a = planes[j], b = planes[j + 1], w = planes[j + 3];
  const ox = (w % ORIGIN_SPAN) - ORIGIN_BIAS;
  const oy = Math.floor(w / ORIGIN_SPAN) - ORIGIN_BIAS;
  const c = planes[j + 2] - UNITS * (a * ox + b * oy);
  return Math.ceil(-c / gcd(Math.abs(a), Math.abs(b)));
}

function gcd(x: number, y: number): number {
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/** The corners of a rect, or of a polygon of one closed contour of straight
 *  edges; `null` for anything else. */
export function cornersOf(path: Path): number[] | null {
  if (path.kind === 'rect') {
    const { x, y, width: w, height: h } = path;
    return [x, y, x + w, y, x + w, y + h, x, y + h];
  }
  if (path.corners?.some((c) => c !== null)) return null;
  const { commands, coords } = path;
  if (commands.length < 4 || commands[0] !== PATH_M || commands[commands.length - 1] !== PATH_Z) return null;
  for (let i = 1; i < commands.length - 1; i++) if (commands[i] !== PATH_L) return null;
  const ox = path.origin?.x ?? 0;
  const oy = path.origin?.y ?? 0;
  return Array.from(coords.subarray(0, (commands.length - 1) * 2), (v, i) => v + (i & 1 ? oy : ox));
}

/** Twice the area, positive when the corners run counterclockwise in window
 *  space (y up). */
export function signedArea(p: number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    s += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return s;
}

export function reverse(p: number[]): void {
  for (let i = 0, j = p.length - 2; i < j; i += 2, j -= 2) {
    const x = p[i], y = p[i + 1];
    p[i] = p[j]; p[i + 1] = p[j + 1];
    p[j] = x; p[j + 1] = y;
  }
}

function cross(p: number[], i: number, j: number, k: number): number {
  return (p[j] - p[i]) * (p[k + 1] - p[j + 1]) - (p[j + 1] - p[i + 1]) * (p[k] - p[j]);
}

/** The corners where the outline actually turns. */
export function dropCollinear(p: number[]): number[] {
  const out: number[] = [];
  const n = p.length;
  for (let i = 0; i < n; i += 2) {
    if (cross(p, (i - 2 + n) % n, i, (i + 2) % n) !== 0) out.push(p[i], p[i + 1]);
  }
  return out;
}

/** Every turn the same way, and once round: the edges' x direction changes
 *  sign at most twice, which a star's does not. */
export function isConvex(p: number[]): boolean {
  const n = p.length;
  let flips = 0;
  let last = 0;
  for (let i = 0; i < n; i += 2) {
    if (cross(p, i, (i + 2) % n, (i + 4) % n) <= 0) return false;
    const dx = Math.sign(p[(i + 2) % n] - p[i]);
    if (dx !== 0) {
      if (last !== 0 && dx !== last) flips++;
      last = dx;
    }
  }
  return flips <= 2;
}

function packOrigin(ox: number, oy: number): number {
  return (ox + ORIGIN_BIAS) + (oy + ORIGIN_BIAS) * ORIGIN_SPAN;
}

/** One half-plane per edge of the counterclockwise polygon `p`, in units. */
function planesOf(p: number[], map: WindowMap): HullSet {
  const count = p.length / 2;
  const planes = new Int32Array(count * 4);
  // Fragments land inside the viewport, so each plane's origin is taken near
  // where its line passes the viewport's center: the constant stays small.
  const centerX = map.midX * UNITS;
  const centerY = map.midY * UNITS;
  for (let e = 0; e < count; e++) {
    const vx = p[2 * e], vy = p[2 * e + 1];
    const dx = p[(2 * e + 2) % p.length] - vx;
    const dy = p[(2 * e + 3) % p.length] - vy;
    const a = -dy;
    const b = dx;
    const tie = a > 0 || (a === 0 && b > 0) ? 0 : 1;
    const t = ((centerX - vx) * dx + (centerY - vy) * dy) / (dx * dx + dy * dy);
    const ox = Math.round((vx + t * dx) / UNITS);
    const oy = Math.round((vy + t * dy) / UNITS);
    let plane: [number, number, number, number];
    if (Math.abs(ox) < ORIGIN_BIAS && Math.abs(oy) < ORIGIN_BIAS) {
      plane = [a, b, a * (UNITS * ox - vx) + b * (UNITS * oy - vy) - tie, packOrigin(ox, oy)];
    } else {
      // The line passes far outside anything drawn, so one side of it holds
      // every fragment: keep all of them, or none.
      const inside = a * (centerX - vx) + b * (centerY - vy) >= tie;
      plane = [0, 0, inside ? 0 : -1, packOrigin(0, 0)];
    }
    planes.set(plane, e * 4);
  }
  return { planes, count };
}

/** The snapped corners back in screen space, for a stencil drawn at identity
 *  to land on the same grid points. */
function screenPolygon(p: number[], map: WindowMap): Path {
  const det = map.ax * map.by - map.bx * map.ay;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < p.length; i += 2) {
    const wx = p[i] / UNITS - map.cx;
    const wy = p[i + 1] / UNITS - map.cy;
    points.push({ x: (map.by * wx - map.bx * wy) / det, y: (map.ax * wy - map.ay * wx) / det });
  }
  return polygonFromPoints(points);
}
