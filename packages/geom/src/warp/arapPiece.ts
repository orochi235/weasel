/**
 * One connected piece of an as-rigid-as-possible mesh holding at least two
 * pins, in its own local vertex numbering, with both systems factored. Its
 * positions are interleaved `x, y` in that numbering, pinned vertices included.
 */
import type { ArapMesh } from './arap';
import { edgeEnergy, similarityEnergy, solveSplit, split, type Split } from './arapSystem';
import { restFrames, type RestFrames } from './injective';

export interface Piece {
  /** Local vertex → mesh vertex. */
  verts: Int32Array;
  /** Rest positions, local. */
  rest: Float64Array;
  /** The larger side of its rest bounds. */
  size: number;
  /** Triangles as local vertex triples. */
  tris: Int32Array;
  /** Local vertex → pin index, or -1 when free. */
  pinOf: Int32Array;
  freeOf: Int32Array;
  step1: Split;
  step2: Split;
  frames: RestFrames;
}

export function buildPiece(mesh: ArapMesh, verts: number[], tris: number[], pinAt: Map<number, number>, local: Int32Array): Piece | null {
  const n = verts.length;
  verts.forEach((v, i) => { local[v] = i; });
  const rest = new Float64Array(2 * n);
  verts.forEach((v, i) => { rest[2 * i] = mesh.vertices[2 * v]; rest[2 * i + 1] = mesh.vertices[2 * v + 1]; });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 2 * n; i += 2) {
    x0 = Math.min(x0, rest[i]); x1 = Math.max(x1, rest[i]); y0 = Math.min(y0, rest[i + 1]); y1 = Math.max(y1, rest[i + 1]);
  }
  const T = mesh.triangles;
  const lt = new Int32Array(3 * tris.length);
  tris.forEach((t, k) => { for (let c = 0; c < 3; c++) lt[3 * k + c] = local[T[3 * t + c]]; });
  const pinOf = Int32Array.from(verts, (v) => pinAt.get(v) ?? -1);
  const freeOf = new Int32Array(n).fill(-1);
  let nf = 0;
  for (let i = 0; i < n; i++) if (pinOf[i] < 0) freeOf[i] = nf++;
  const free2 = Int32Array.from({ length: 2 * n }, (_, u) => (freeOf[u >> 1] < 0 ? -1 : 2 * freeOf[u >> 1] + (u & 1)));
  const step1 = split(similarityEnergy(rest, lt, n), free2);
  const step2 = split(edgeEnergy(lt, n), freeOf);
  if (!step1 || !step2) return null;
  return { verts: Int32Array.from(verts), rest, size: Math.max(x1 - x0, y1 - y0), tris: lt, pinOf, freeOf, step1, step2, frames: restFrames(rest, lt) };
}

/** The similarity step: the shape keeping each triangle closest to a turned and scaled copy of itself. */
export function similaritySolve(piece: Piece, targets: ArrayLike<number>): Float64Array {
  const { pinOf, freeOf, step1 } = piece;
  const x = solveSplit(step1, (u) => targets[2 * pinOf[u >> 1] + (u & 1)], new Float64Array(step1.coupling.length));
  const pos = new Float64Array(2 * pinOf.length);
  for (let i = 0; i < pinOf.length; i++) {
    for (let c = 0; c < 2; c++) pos[2 * i + c] = pinOf[i] >= 0 ? targets[2 * pinOf[i] + c] : x[2 * freeOf[i] + c];
  }
  return pos;
}

/**
 * One local/global round from `pos`: fit a turned, unscaled copy of each rest
 * triangle to it, then find the vertices that best agree with every copy.
 * Returns the new positions and the rigidity energy `pos` had against the fit.
 */
export function rigidRound(piece: Piece, targets: ArrayLike<number>, pos: Float64Array): { pos: Float64Array; energy: number } {
  const { rest, tris, pinOf, freeOf, step2 } = piece;
  const nf = step2.coupling.length;
  const bx = new Float64Array(nf), by = new Float64Array(nf);
  let energy = 0;
  for (let t = 0; t < tris.length; t += 3) {
    let dot = 0, cross = 0, sq = 0;
    for (let e = 0; e < 3; e++) {
      const i = tris[t + e], j = tris[t + (e + 1) % 3];
      const px = rest[2 * i] - rest[2 * j], py = rest[2 * i + 1] - rest[2 * j + 1];
      const qx = pos[2 * i] - pos[2 * j], qy = pos[2 * i + 1] - pos[2 * j + 1];
      dot += px * qx + py * qy;
      cross += px * qy - py * qx;
      sq += px * px + py * py + qx * qx + qy * qy;
    }
    const len = Math.hypot(dot, cross);
    energy += sq - 2 * len;
    const cos = len === 0 ? 1 : dot / len, sin = len === 0 ? 0 : cross / len;
    for (let e = 0; e < 3; e++) {
      const i = tris[t + e], j = tris[t + (e + 1) % 3];
      const ex = rest[2 * i] - rest[2 * j], ey = rest[2 * i + 1] - rest[2 * j + 1];
      const fx = cos * ex - sin * ey, fy = sin * ex + cos * ey;
      if (freeOf[i] >= 0) { bx[freeOf[i]] += fx; by[freeOf[i]] += fy; }
      if (freeOf[j] >= 0) { bx[freeOf[j]] -= fx; by[freeOf[j]] -= fy; }
    }
  }
  const x = solveSplit(step2, (u) => targets[2 * pinOf[u]], bx);
  const y = solveSplit(step2, (u) => targets[2 * pinOf[u] + 1], by);
  const out = new Float64Array(pos.length);
  for (let i = 0; i < pinOf.length; i++) {
    const p = pinOf[i];
    out[2 * i] = p >= 0 ? targets[2 * p] : x[freeOf[i]];
    out[2 * i + 1] = p >= 0 ? targets[2 * p + 1] : y[freeOf[i]];
  }
  return { pos: out, energy };
}

/** Copy a piece's positions into the whole mesh's. */
export function placePiece(piece: Piece, pos: Float64Array, out: Float64Array): void {
  piece.verts.forEach((v, i) => { out[2 * v] = pos[2 * i]; out[2 * v + 1] = pos[2 * i + 1]; });
}
