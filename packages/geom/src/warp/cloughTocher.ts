/**
 * A smooth map through a deformed triangle mesh: the Clough–Tocher
 * interpolant (Farin's reduced form). Each triangle is split at its centroid
 * into three cubic pieces built from the vertices' positions and derivatives,
 * and the derivative across every edge, between triangles and inside one, is
 * the same on both sides. Only the triangle holding a point is read, so a
 * point costs what one cubic costs.
 */
import type { ArapMesh } from './arap';
import type { MeshSpot } from './meshMap';

/** What the interpolant needs of a mesh at rest, set up once per mesh: each
 *  triangle's inverse edge matrix and area. */
export interface RestFrames {
  inverse: Float64Array;
  area: Float64Array;
}

export function restFrames(mesh: ArapMesh): RestFrames {
  const V = mesh.vertices, T = mesh.triangles;
  const nt = T.length / 3;
  const inverse = new Float64Array(4 * nt);
  const area = new Float64Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
    const ux = V[2 * b] - V[2 * a], uy = V[2 * b + 1] - V[2 * a + 1];
    const vx = V[2 * c] - V[2 * a], vy = V[2 * c + 1] - V[2 * a + 1];
    const det = ux * vy - uy * vx;
    if (det === 0) continue;
    inverse.set([vy / det, -vx / det, -uy / det, ux / det], 4 * t);
    area[t] = Math.abs(det) / 2;
  }
  return { inverse, area };
}

/** Each vertex's derivative under the deformation `at`: the area-weighted
 *  mean of its triangles' affine derivatives, row-major 2×2. */
function vertexDerivatives(mesh: ArapMesh, frames: RestFrames, at: Float64Array): Float64Array {
  const T = mesh.triangles;
  const nv = mesh.vertices.length / 2;
  const J = new Float64Array(4 * nv);
  const weight = new Float64Array(nv);
  for (let t = 0; t < T.length / 3; t++) {
    const w = frames.area[t];
    if (w === 0) continue;
    const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
    const ux = at[2 * b] - at[2 * a], uy = at[2 * b + 1] - at[2 * a + 1];
    const vx = at[2 * c] - at[2 * a], vy = at[2 * c + 1] - at[2 * a + 1];
    const i = frames.inverse;
    const m0 = ux * i[4 * t] + vx * i[4 * t + 2], m1 = ux * i[4 * t + 1] + vx * i[4 * t + 3];
    const m2 = uy * i[4 * t] + vy * i[4 * t + 2], m3 = uy * i[4 * t + 1] + vy * i[4 * t + 3];
    for (const v of [a, b, c]) {
      J[4 * v] += w * m0; J[4 * v + 1] += w * m1; J[4 * v + 2] += w * m2; J[4 * v + 3] += w * m3;
      weight[v] += w;
    }
  }
  for (let v = 0; v < nv; v++) {
    if (weight[v] === 0) { J[4 * v] = 1; J[4 * v + 3] = 1; continue; }
    for (let k = 0; k < 4; k++) J[4 * v + k] /= weight[v];
  }
  return J;
}

/*
 * A triangle's Bézier ordinates, 19 points. For corner i: its position F+i,
 * its ordinate toward the centroid S+i and the next one in, I+i. Toward the
 * corner after it, N+i, and the one before, P+i. M+k sits on the edge opposite
 * corner k, and C is the centroid.
 */
const F = 0, S = 3, I = 6, N = 9, P = 12, M = 15, C = 18;
const ORDINATES = 19;

function buildOrdinates(V: Float64Array, T: Uint32Array, at: Float64Array, J: Float64Array, t: number, out: Float64Array): void {
  const vx = [0, 0, 0], vy = [0, 0, 0], v = [0, 0, 0];
  for (let k = 0; k < 3; k++) { v[k] = T[3 * t + k]; vx[k] = V[2 * v[k]]; vy[k] = V[2 * v[k] + 1]; }
  const sx = (vx[0] + vx[1] + vx[2]) / 3, sy = (vy[0] + vy[1] + vy[2]) / 3;
  const set = (o: number, x: number, y: number) => { out[2 * o] = x; out[2 * o + 1] = y; };
  const x = (o: number) => out[2 * o], y = (o: number) => out[2 * o + 1];
  // Corner k's tangent plane, a third of the way to (px, py).
  const toward = (o: number, k: number, px: number, py: number) => {
    const dx = (px - vx[k]) / 3, dy = (py - vy[k]) / 3, j = 4 * v[k];
    set(o, at[2 * v[k]] + J[j] * dx + J[j + 1] * dy, at[2 * v[k] + 1] + J[j + 2] * dx + J[j + 3] * dy);
  };
  for (let k = 0; k < 3; k++) {
    const n = (k + 1) % 3, p = (k + 2) % 3;
    set(F + k, at[2 * v[k]], at[2 * v[k] + 1]);
    toward(S + k, k, sx, sy);
    toward(N + k, k, vx[n], vy[n]);
    toward(P + k, k, vx[p], vy[p]);
  }
  // The edge ordinate that makes the derivative along the edge's normal linear
  // along the edge: then both triangles beside it agree on it.
  for (let k = 0; k < 3; k++) {
    const a = (k + 1) % 3, b = (k + 2) % 3;
    const ex = vx[b] - vx[a], ey = vy[b] - vy[a];
    const lb = ((sx - vx[a]) * ex + (sy - vy[a]) * ey) / (ex * ex + ey * ey), la = 1 - lb;
    const mid = (c: (o: number) => number) => la * c(N + a) + lb * c(P + b)
      + 0.5 * (c(S + a) - la * c(F + a) - lb * c(N + a) + c(S + b) - la * c(P + b) - lb * c(F + b));
    set(M + k, mid(x), mid(y));
  }
  for (let k = 0; k < 3; k++) {
    // The ordinate beside corner k's on the spoke to the centroid, between the two edges that meet at k.
    const e1 = M + (k + 1) % 3, e2 = M + (k + 2) % 3;
    set(I + k, (x(S + k) + x(e1) + x(e2)) / 3, (y(S + k) + y(e1) + y(e2)) / 3);
  }
  set(C, (x(I) + x(I + 1) + x(I + 2)) / 3, (y(I) + y(I + 1) + y(I + 2)) / 3);
}

/** For the piece beside the edge opposite each corner, where each of its ten ordinates sits, in term order. */
const PIECES = [0, 1, 2].map((k) => {
  const a = (k + 1) % 3, b = (k + 2) % 3;
  return Int32Array.from([F + a, F + b, C, N + a, P + b, S + a, I + a, S + b, I + b, M + k], (o) => 2 * o);
});

/**
 * The cubic piece's value at weights `w` (on corners 0, 1, 2) inside the
 * triangle, plus its derivative along the weight step `d` where one is given.
 */
function evaluate(o: Float64Array, base: number, w: readonly number[], d: readonly number[] = [0, 0, 0]): { x: number; y: number } {
  const k = w[0] <= w[1] && w[0] <= w[2] ? 0 : w[1] <= w[2] ? 1 : 2;
  const a = (k + 1) % 3, b = (k + 2) % 3;
  const u = w[a] - w[k], v = w[b] - w[k], s = 3 * w[k];
  const du = d[a] - d[k], dv = d[b] - d[k], ds = 3 * d[k];
  const c0 = u * u * u + 3 * u * u * du;
  const c1 = v * v * v + 3 * v * v * dv;
  const c2 = s * s * s + 3 * s * s * ds;
  const c3 = 3 * (u * u * v + 2 * u * v * du + u * u * dv);
  const c4 = 3 * (u * v * v + v * v * du + 2 * u * v * dv);
  const c5 = 3 * (u * u * s + 2 * u * s * du + u * u * ds);
  const c6 = 3 * (u * s * s + s * s * du + 2 * u * s * ds);
  const c7 = 3 * (v * v * s + 2 * v * s * dv + v * v * ds);
  const c8 = 3 * (v * s * s + s * s * dv + 2 * v * s * ds);
  const c9 = 6 * (u * v * s + v * s * du + u * s * dv + u * v * ds);
  const q = PIECES[k];
  const sum = (c: number) =>
    c0 * o[base + q[0] + c] + c1 * o[base + q[1] + c] + c2 * o[base + q[2] + c] + c3 * o[base + q[3] + c]
    + c4 * o[base + q[4] + c] + c5 * o[base + q[5] + c] + c6 * o[base + q[6] + c] + c7 * o[base + q[7] + c]
    + c8 * o[base + q[8] + c] + c9 * o[base + q[9] + c];
  return { x: sum(0), y: sum(1) };
}

/**
 * The smooth map carrying `mesh` onto its vertices placed at `at`, read at a
 * point's spot. A spot outside its triangle, a point off the mesh, takes the
 * value and derivative at the nearest weights inside it and steps on from
 * there in a straight line, so the map runs on smoothly past the outline
 * without the cubic's growth far from it. Each triangle's
 * ordinates are built the first time a point lands in it.
 */
export function cloughTocherMap(mesh: ArapMesh, frames: RestFrames, at: Float64Array): (spot: MeshSpot) => { x: number; y: number } {
  const V = mesh.vertices, T = mesh.triangles;
  const J = vertexDerivatives(mesh, frames, at);
  const ordinates = new Float64Array(2 * ORDINATES * (T.length / 3));
  const built = new Uint8Array(T.length / 3);
  return (spot) => {
    const t = spot.tri;
    if (!built[t]) { buildOrdinates(V, T, at, J, t, ordinates.subarray(2 * ORDINATES * t, 2 * ORDINATES * (t + 1))); built[t] = 1; }
    const base = 2 * ORDINATES * t;
    const w = [spot.w0, spot.w1, spot.w2];
    if (w[0] >= 0 && w[1] >= 0 && w[2] >= 0) return evaluate(ordinates, base, w);
    const clamped = w.map((v) => Math.max(0, v));
    const sum = clamped[0] + clamped[1] + clamped[2];
    const near = clamped.map((v) => v / sum);
    return evaluate(ordinates, base, near, w.map((v, i) => v - near[i]));
  };
}
