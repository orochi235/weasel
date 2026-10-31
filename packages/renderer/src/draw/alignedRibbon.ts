/**
 * An inner or outer stroke on a convex outline, cut on the CPU so it joins the
 * run rather than drawing through the stencil: the centered ribbon twice as
 * wide, kept inside the fill's polygon for an inner stroke and outside it for
 * an outer one, which is what `drawPathStrokeStenciled` leaves on screen. The
 * polygon is the fill mesh that stencil pass draws, so both cut along the
 * same edges; on a multisampled target a sample on such an edge can still go
 * the other way (`batchClip.ts`).
 */
import type { Mesh } from '@weasel-js/geom/tessellate';
import { clipPlane, ringPlanes } from '../batchClip';

/** Edges a fill's polygon may have and still be cut to: a circle flattened
 *  at a large size holds a few hundred. */
const MAX_RING_EDGES = 512;

const built = new WeakMap<Mesh, { fill: Mesh; inner: boolean; mesh: Mesh | null }>();

/**
 * `ribbon`, a centered ribbon twice the stroke's width, cut to the inside of
 * `fill` (`inner`) or its outside, or `null` when `fill` is not one convex
 * polygon. Kept per ribbon mesh while `fill` and the side hold.
 */
export function alignedRibbon(ribbon: Mesh, fill: Mesh, inner: boolean): Mesh | null {
  const last = built.get(ribbon);
  if (last !== undefined && last.fill === fill && last.inner === inner) return last.mesh;
  const planes = outlinePlanes(fill, ribbon.origin);
  const mesh = planes === null ? null : cutRibbon(ribbon, planes, inner);
  built.set(ribbon, { fill, inner, mesh });
  return mesh;
}

/** `fill`'s outline as half-planes in `origin`'s frame, where `fill` is one
 *  convex ring: earcut leaves a ring of `n` distinct corners with no holes as
 *  `n - 2` triangles over them, in order. */
function outlinePlanes(fill: Mesh, origin: Mesh['origin']): Float64Array | null {
  if (fill.requiresStencil) return null;
  const v = fill.vertices;
  const dx = (fill.origin?.x ?? 0) - (origin?.x ?? 0);
  const dy = (fill.origin?.y ?? 0) - (origin?.y ?? 0);
  const ring: number[] = [];
  for (let i = 0; i < v.length; i += 2) {
    const k = ring.length;
    const x = v[i] + dx, y = v[i + 1] + dy;
    if (k >= 2 && ring[k - 2] === x && ring[k - 1] === y) continue;
    ring.push(x, y);
  }
  while (ring.length >= 4 && ring[0] === ring[ring.length - 2] && ring[1] === ring[ring.length - 1]) ring.length -= 2;
  const n = ring.length / 2;
  if (n < 3 || fill.indices.length !== (n - 2) * 3) return null;
  return ringPlanes(ring, MAX_RING_EDGES);
}

/** Ping-pong buffers for one triangle's cut, sized for every plane at once. */
const scratch = { a: new Float32Array(0), b: new Float32Array(0) };

function cutRibbon(ribbon: Mesh, planes: Float64Array, inner: boolean): Mesh {
  const planeCount = planes.length / 3;
  // A triangle gains at most a corner a pass, and takes a pass a plane plus one.
  if (scratch.a.length < (planeCount + 4) * 2) {
    scratch.a = new Float32Array((planeCount + 4) * 2);
    scratch.b = new Float32Array((planeCount + 4) * 2);
  }
  const v = ribbon.vertices;
  const idx = ribbon.indices;
  const outVerts: number[] = [];
  const outIdx: number[] = [];
  const crossed: number[] = [];
  const tri = new Float32Array(6);
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      tri[k * 2] = v[idx[t + k] * 2];
      tri[k * 2 + 1] = v[idx[t + k] * 2 + 1];
    }
    crossed.length = 0;
    let outside = false;
    for (let p = 0; p < planes.length && !outside; p += 3) {
      let ins = 0;
      for (let k = 0; k < 3; k++) if (planes[p] * tri[k * 2] + planes[p + 1] * tri[k * 2 + 1] + planes[p + 2] >= 0) ins++;
      if (ins === 0) outside = true;
      else if (ins < 3) crossed.push(p);
    }
    if (outside) {
      if (!inner) emit(tri, 3, outVerts, outIdx);
      continue;
    }
    if (inner) {
      emit(scratch.a, cutTo(tri, crossed, crossed.length, planes, -1), outVerts, outIdx);
    } else {
      // What lies outside the polygon, as disjoint convex pieces: past the
      // k-th crossed plane, and inside every one before it.
      for (let k = 0; k < crossed.length; k++) {
        emit(scratch.a, cutTo(tri, crossed, k, planes, crossed[k]), outVerts, outIdx);
      }
    }
  }
  return {
    vertices: new Float32Array(outVerts),
    indices: new Uint32Array(outIdx),
    ...(ribbon.origin ? { origin: ribbon.origin } : {}),
  };
}

/**
 * Cut `tri` to the inside of the first `count` planes named in `crossed`, and
 * to the outside of the plane at `beyond` unless that is -1, leaving the
 * result in `scratch.a`. Returns its corner count.
 */
function cutTo(tri: Float32Array, crossed: number[], count: number, planes: Float64Array, beyond: number): number {
  let from = scratch.a, to = scratch.b;
  from.set(tri);
  let n = 3;
  for (let k = 0; k <= count && n >= 3; k++) {
    if (k === count && beyond < 0) break;
    const p = k === count ? beyond : crossed[k];
    const sign = k === count ? -1 : 1;
    n = clipPlane(from, n, 2, sign * planes[p], sign * planes[p + 1], sign * planes[p + 2], to);
    const swap = from;
    from = to;
    to = swap;
  }
  if (from !== scratch.a) scratch.a.set(from.subarray(0, n * 2));
  return n;
}

/** Append the first `n` corners of `src` as a fan. */
function emit(src: Float32Array, n: number, verts: number[], idx: number[]): void {
  if (n < 3) return;
  const base = verts.length / 2;
  for (let k = 0; k < n * 2; k++) verts.push(src[k]);
  for (let k = 1; k < n - 1; k++) idx.push(base, base + k, base + k + 1);
}
