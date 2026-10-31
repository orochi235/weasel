/**
 * A ribbon cut to the inside or the outside of a fill that is not one convex
 * ring, against the fill's own triangles: inside is the pieces of each ribbon
 * triangle within each fill triangle, and outside what is left once every
 * fill triangle is taken away. A fill mesh that needs no stencil covers its
 * inside once, so the pieces never overlap.
 *
 * Pieces meet along the fill's diagonals as well as its outline, at cut
 * points computed from either side, so a sample on a diagonal can fall in a
 * seam as well as on an outline edge (`batchClip.ts`).
 */
import type { Mesh } from '@weasel-js/geom/tessellate';
import { clipPlane } from '../batchClip';

/** Steps one cut may take, each a polygon tested against a triangle or cut
 *  by a plane, before the stroke is left to the stencil. */
export const MAX_TRIANGLE_CUT_WORK = 1 << 16;

/** `fill`'s triangles in a ribbon's frame: three half-planes each, keeping
 *  the inside, a box each, and a grid over the boxes. */
interface FillTriangles {
  readonly planes: Float64Array;
  readonly boxes: Float64Array;
  readonly count: number;
  readonly grid: Grid;
}

interface Grid {
  readonly x0: number; readonly y0: number;
  readonly cell: number; readonly cols: number; readonly rows: number;
  readonly cells: number[][];
}

/**
 * `ribbon` cut to the inside of `fill`'s triangles (`inner`) or their
 * outside, or `null` when the cut would take more than `budget` steps.
 * `fill` must not need the stencil.
 */
export function cutToTriangles(ribbon: Mesh, fill: Mesh, inner: boolean, budget = MAX_TRIANGLE_CUT_WORK): Mesh | null {
  const tris = fillTriangles(fill, ribbon.origin);
  const out = { verts: [] as number[], idx: [] as number[] };
  const work = { left: budget };
  const stamps = new Int32Array(tris.count);
  const near: number[] = [];
  const v = ribbon.vertices, idx = ribbon.indices;
  const tri = new Float32Array(6);
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      tri[k * 2] = v[idx[t + k] * 2];
      tri[k * 2 + 1] = v[idx[t + k] * 2 + 1];
    }
    candidates(tris, tri, t / 3 + 1, stamps, near);
    const ok = inner ? keepInside(tri, tris, near, out, work) : keepOutside(tri, tris, near, out, work);
    if (!ok) return null;
  }
  return {
    vertices: new Float32Array(out.verts),
    indices: new Uint32Array(out.idx),
    ...(ribbon.origin ? { origin: ribbon.origin } : {}),
  };
}

type Out = { verts: number[]; idx: number[] };
type Work = { left: number };

function keepInside(tri: Float32Array, tris: FillTriangles, near: number[], out: Out, work: Work): boolean {
  for (const c of near) {
    if (--work.left < 0) return false;
    const crossed = classify(tri, 3, tris.planes, c);
    if (crossed === OUTSIDE) continue;
    if (crossed === 0) {
      emit(tri, 3, out);
      return true;
    }
    let poly = tri, n = 3;
    for (let k = 0; k < 3 && n >= 3; k++) {
      if ((crossed & (1 << k)) === 0) continue;
      if (--work.left < 0) return false;
      [poly, n] = cut(poly, n, tris.planes, (c * 3 + k) * 3, 1);
    }
    emit(poly, n, out);
  }
  return true;
}

function keepOutside(tri: Float32Array, tris: FillTriangles, near: number[], out: Out, work: Work): boolean {
  let pieces: [Float32Array, number][] = [[tri, 3]];
  for (const c of near) {
    const next: [Float32Array, number][] = [];
    for (const [poly, n] of pieces) {
      if (--work.left < 0) return false;
      const crossed = classify(poly, n, tris.planes, c);
      if (crossed === OUTSIDE) { next.push([poly, n]); continue; }
      // Past the k-th crossed edge, and inside every crossed edge before it:
      // what lies outside the triangle, as disjoint convex pieces.
      let inside = poly, m = n;
      for (let k = 0; k < 3 && m >= 3; k++) {
        if ((crossed & (1 << k)) === 0) continue;
        work.left -= 2;
        if (work.left < 0) return false;
        const plane = (c * 3 + k) * 3;
        const [past, p] = cut(inside, m, tris.planes, plane, -1);
        if (p >= 3) next.push([past, p]);
        [inside, m] = cut(inside, m, tris.planes, plane, 1);
      }
    }
    pieces = next;
    if (pieces.length === 0) return true;
  }
  for (const [poly, n] of pieces) emit(poly, n, out);
  return true;
}

/** Every corner outside one and the same edge of triangle `c`. */
const OUTSIDE = -1;

/**
 * Where the `n` corners of `poly` sit against triangle `c`: `OUTSIDE`, or a
 * mask of the edges they straddle, `0` when all of them are inside.
 */
function classify(poly: Float32Array, n: number, planes: Float64Array, c: number): number {
  let crossed = 0;
  for (let k = 0; k < 3; k++) {
    const p = (c * 3 + k) * 3;
    let ins = 0;
    for (let i = 0; i < n; i++) if (planes[p] * poly[i * 2] + planes[p + 1] * poly[i * 2 + 1] + planes[p + 2] >= 0) ins++;
    if (ins === 0) return OUTSIDE;
    if (ins < n) crossed |= 1 << k;
  }
  return crossed;
}

const scratch = { buf: new Float32Array(16) };

/** `poly` cut to the side of the plane at `p` that `sign` names, as a new array. */
function cut(poly: Float32Array, n: number, planes: Float64Array, p: number, sign: 1 | -1): [Float32Array, number] {
  if (scratch.buf.length < (n + 1) * 2) scratch.buf = new Float32Array((n + 1) * 4);
  const m = clipPlane(poly, n, 2, sign * planes[p], sign * planes[p + 1], sign * planes[p + 2], scratch.buf);
  return [scratch.buf.slice(0, m * 2), m];
}

function emit(src: Float32Array, n: number, out: Out): void {
  if (n < 3) return;
  const base = out.verts.length / 2;
  for (let k = 0; k < n * 2; k++) out.verts.push(src[k]);
  for (let k = 1; k < n - 1; k++) out.idx.push(base, base + k, base + k + 1);
}

/** The triangles of `fill` whose boxes meet `tri`'s, into `near`; `stamp`
 *  marks each in `stamps` so a triangle in several cells is listed once. */
function candidates(tris: FillTriangles, tri: Float32Array, stamp: number, stamps: Int32Array, near: number[]): void {
  near.length = 0;
  const x0 = Math.min(tri[0], tri[2], tri[4]), x1 = Math.max(tri[0], tri[2], tri[4]);
  const y0 = Math.min(tri[1], tri[3], tri[5]), y1 = Math.max(tri[1], tri[3], tri[5]);
  const g = tris.grid;
  const c0 = Math.max(0, Math.floor((x0 - g.x0) / g.cell)), c1 = Math.min(g.cols - 1, Math.floor((x1 - g.x0) / g.cell));
  const r0 = Math.max(0, Math.floor((y0 - g.y0) / g.cell)), r1 = Math.min(g.rows - 1, Math.floor((y1 - g.y0) / g.cell));
  const b = tris.boxes;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      for (const t of g.cells[r * g.cols + c]) {
        if (stamps[t] === stamp) continue;
        stamps[t] = stamp;
        if (b[t * 4] > x1 || b[t * 4 + 2] < x0 || b[t * 4 + 1] > y1 || b[t * 4 + 3] < y0) continue;
        near.push(t);
      }
    }
  }
}

const built = new WeakMap<Mesh, { origin: Mesh['origin']; tris: FillTriangles }>();

function fillTriangles(fill: Mesh, origin: Mesh['origin']): FillTriangles {
  const last = built.get(fill);
  if (last !== undefined && last.origin === origin) return last.tris;
  const tris = buildTriangles(fill, origin);
  built.set(fill, { origin, tris });
  return tris;
}

function buildTriangles(fill: Mesh, origin: Mesh['origin']): FillTriangles {
  const dx = (fill.origin?.x ?? 0) - (origin?.x ?? 0);
  const dy = (fill.origin?.y ?? 0) - (origin?.y ?? 0);
  const v = fill.vertices, idx = fill.indices;
  const planes: number[] = [];
  const boxes: number[] = [];
  const pt = new Float64Array(6);
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      pt[k * 2] = v[idx[t + k] * 2] + dx;
      pt[k * 2 + 1] = v[idx[t + k] * 2 + 1] + dy;
    }
    const area = (pt[2] - pt[0]) * (pt[5] - pt[1]) - (pt[4] - pt[0]) * (pt[3] - pt[1]);
    if (area === 0) continue;
    const order = area > 0 ? [0, 1, 2] : [0, 2, 1];
    for (let k = 0; k < 3; k++) edgePlane(pt, order[k], order[(k + 1) % 3], planes);
    boxes.push(
      Math.min(pt[0], pt[2], pt[4]), Math.min(pt[1], pt[3], pt[5]),
      Math.max(pt[0], pt[2], pt[4]), Math.max(pt[1], pt[3], pt[5]),
    );
  }
  const count = boxes.length / 4;
  return { planes: new Float64Array(planes), boxes: new Float64Array(boxes), count, grid: gridOver(boxes, count) };
}

/**
 * The half-plane left of the edge from corner `i` to corner `j`, computed
 * from its ends in one order however it is walked, so the two triangles
 * sharing a diagonal hold exactly opposite planes for it.
 */
function edgePlane(pt: Float64Array, i: number, j: number, out: number[]): void {
  const swap = pt[j * 2] < pt[i * 2] || (pt[j * 2] === pt[i * 2] && pt[j * 2 + 1] < pt[i * 2 + 1]);
  const [p, q] = swap ? [j, i] : [i, j];
  const px = pt[p * 2], py = pt[p * 2 + 1], qx = pt[q * 2], qy = pt[q * 2 + 1];
  const len = Math.hypot(qx - px, qy - py);
  const a = -(qy - py) / len, b = (qx - px) / len, c = -(a * px + b * py);
  const s = swap ? -1 : 1;
  out.push(s * a, s * b, s * c);
}

/** About one triangle a cell, and at most 64 cells a side. */
function gridOver(boxes: number[], count: number): Grid {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let t = 0; t < count; t++) {
    x0 = Math.min(x0, boxes[t * 4]); y0 = Math.min(y0, boxes[t * 4 + 1]);
    x1 = Math.max(x1, boxes[t * 4 + 2]); y1 = Math.max(y1, boxes[t * 4 + 3]);
  }
  if (count === 0) return { x0: 0, y0: 0, cell: 1, cols: 1, rows: 1, cells: [[]] };
  const side = Math.min(64, Math.max(1, Math.ceil(Math.sqrt(count))));
  const cell = Math.max(x1 - x0, y1 - y0, 1e-6) / side;
  const cols = Math.max(1, Math.ceil((x1 - x0) / cell)), rows = Math.max(1, Math.ceil((y1 - y0) / cell));
  const cells: number[][] = Array.from({ length: cols * rows }, () => []);
  for (let t = 0; t < count; t++) {
    const c0 = Math.min(cols - 1, Math.floor((boxes[t * 4] - x0) / cell));
    const c1 = Math.min(cols - 1, Math.floor((boxes[t * 4 + 2] - x0) / cell));
    const r0 = Math.min(rows - 1, Math.floor((boxes[t * 4 + 1] - y0) / cell));
    const r1 = Math.min(rows - 1, Math.floor((boxes[t * 4 + 3] - y0) / cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells[r * cols + c].push(t);
  }
  return { x0, y0, cell, cols, rows, cells };
}
