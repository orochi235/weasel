/**
 * A point's place in a triangle mesh, as the triangle holding it and its
 * barycentric weights there, so the point can follow the triangle when the
 * mesh deforms. A point outside every triangle takes the nearest one's
 * weights, extended past its edge.
 */
import type { ArapMesh } from './arap';

/** A triangle and a point's weights on its three corners. */
export interface MeshSpot {
  tri: number;
  w0: number;
  w1: number;
  w2: number;
}

const EPS = 1e-9;

function weights(V: Float64Array, T: Uint32Array, t: number, x: number, y: number): MeshSpot | null {
  const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
  const ax = V[2 * a], ay = V[2 * a + 1];
  const bx = V[2 * b] - ax, by = V[2 * b + 1] - ay;
  const cx = V[2 * c] - ax, cy = V[2 * c + 1] - ay;
  const det = bx * cy - by * cx;
  if (det === 0) return null;
  const px = x - ax, py = y - ay;
  const w1 = (px * cy - py * cx) / det;
  const w2 = (bx * py - by * px) / det;
  return { tri: t, w0: 1 - w1 - w2, w1, w2 };
}

/** How far outside its triangle a spot lies, in weight terms; 0 inside. */
const outside = (s: MeshSpot) => Math.max(0, -s.w0, -s.w1, -s.w2);

/** A lookup of the spot each point of the plane takes in `mesh`, through a bucket grid. */
export function meshLocator(mesh: ArapMesh): (x: number, y: number) => MeshSpot | null {
  const V = mesh.vertices, T = mesh.triangles;
  const nt = T.length / 3;
  if (nt === 0) return () => null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < V.length; i += 2) {
    x0 = Math.min(x0, V[i]); x1 = Math.max(x1, V[i]); y0 = Math.min(y0, V[i + 1]); y1 = Math.max(y1, V[i + 1]);
  }
  const side = Math.max(1, Math.ceil(Math.sqrt(nt)));
  const cw = (x1 - x0) / side || 1, ch = (y1 - y0) / side || 1;
  const cell = (v: number, o: number, s: number) => Math.min(side - 1, Math.max(0, Math.floor((v - o) / s)));
  const buckets: number[][] = Array.from({ length: side * side }, () => []);
  for (let t = 0; t < nt; t++) {
    let tx0 = Infinity, ty0 = Infinity, tx1 = -Infinity, ty1 = -Infinity;
    for (let k = 0; k < 3; k++) {
      const v = T[3 * t + k];
      tx0 = Math.min(tx0, V[2 * v]); tx1 = Math.max(tx1, V[2 * v]);
      ty0 = Math.min(ty0, V[2 * v + 1]); ty1 = Math.max(ty1, V[2 * v + 1]);
    }
    for (let i = cell(tx0, x0, cw); i <= cell(tx1, x0, cw); i++) {
      for (let j = cell(ty0, y0, ch); j <= cell(ty1, y0, ch); j++) buckets[j * side + i].push(t);
    }
  }
  return (x, y) => {
    const ci = cell(x, x0, cw), cj = cell(y, y0, ch);
    let best: MeshSpot | null = null;
    let bestOut = Infinity;
    // Widen the search ring by ring until a triangle holds the point, or the
    // nearest found cannot be beaten by a farther ring.
    for (let r = 0; r < side; r++) {
      for (let i = ci - r; i <= ci + r; i++) {
        for (let j = cj - r; j <= cj + r; j++) {
          if (i < 0 || j < 0 || i >= side || j >= side) continue;
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
          for (const t of buckets[j * side + i]) {
            const s = weights(V, T, t, x, y);
            if (!s) continue;
            const o = outside(s);
            if (o <= EPS) return s;
            if (o < bestOut) { bestOut = o; best = s; }
          }
        }
      }
      if (best && r >= 1) return best;
    }
    return best;
  };
}

/** Where `spot` lands on the mesh's vertices placed at `at`. */
export function placeSpot(T: Uint32Array, at: Float64Array, s: MeshSpot): { x: number; y: number } {
  const a = T[3 * s.tri], b = T[3 * s.tri + 1], c = T[3 * s.tri + 2];
  return {
    x: s.w0 * at[2 * a] + s.w1 * at[2 * b] + s.w2 * at[2 * c],
    y: s.w0 * at[2 * a + 1] + s.w1 * at[2 * b + 1] + s.w2 * at[2 * c + 1],
  };
}
