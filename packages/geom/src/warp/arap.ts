/**
 * As-rigid-as-possible deformation of a triangle mesh with pinned vertices
 * (Igarashi, Moscovich and Hughes, 2005), in two linear steps. The first finds
 * the shape that keeps each triangle as close to a scaled and turned copy of
 * itself as the pins allow; the second fits a copy of each rest triangle to
 * that result without the scale and finds the vertices that best agree with
 * every copy. Both systems depend only on the mesh and which vertices are
 * pinned, so they are factored once per pin set and only re-solved as the pins
 * move.
 */
import { addSymmetric, factorSymmetric, symmetricRows, type Factored, type SymmetricRows } from './profileCholesky';

/** A triangle mesh at rest: interleaved `x, y` vertices and vertex-index triples. */
export interface ArapMesh {
  vertices: Float64Array;
  triangles: Uint32Array;
}

/** A factored deformation; `solve` takes each pinned vertex's target, as
 *  interleaved `x, y` in pin order, and returns every vertex's position. */
export interface ArapSolver {
  solve(targets: ArrayLike<number>): Float64Array;
}

/** A linear system split into its free and pinned unknowns. */
interface Split {
  factored: Factored;
  /** For each free unknown, the pinned unknowns it couples to and by how much. */
  coupling: { at: Int32Array; by: Float64Array }[];
}

function split(full: SymmetricRows, isFree: (u: number) => boolean, freeIndex: Int32Array): Split | null {
  const nFree = full.filter((_, u) => isFree(u)).length;
  const rows = symmetricRows(nFree);
  const coupling: { at: number[]; by: number[] }[] = Array.from({ length: nFree }, () => ({ at: [], by: [] }));
  full.forEach((row, i) => row.forEach((v, j) => {
    const fi = isFree(i), fj = isFree(j);
    if (fi && fj) addSymmetric(rows, freeIndex[i], freeIndex[j], v);
    else if (fi) { coupling[freeIndex[i]].at.push(j); coupling[freeIndex[i]].by.push(v); }
    else if (fj) { coupling[freeIndex[j]].at.push(i); coupling[freeIndex[j]].by.push(v); }
  }));
  const factored = factorSymmetric(rows);
  if (!factored) return null;
  return { factored, coupling: coupling.map((c) => ({ at: Int32Array.from(c.at), by: Float64Array.from(c.by) })) };
}

/** Step one's energy: each triangle vertex kept where its opposite edge, turned and scaled, puts it. */
function similarityEnergy(mesh: ArapMesh, tris: number[], local: Int32Array, n: number): SymmetricRows {
  const rows = symmetricRows(2 * n);
  const V = mesh.vertices, T = mesh.triangles;
  const coef = new Float64Array(6);
  const idx = new Int32Array(6);
  for (const t of tris) {
    for (let e = 0; e < 3; e++) {
      const a = T[3 * t + e], b = T[3 * t + (e + 1) % 3], c = T[3 * t + (e + 2) % 3];
      const dx = V[2 * b] - V[2 * a], dy = V[2 * b + 1] - V[2 * a + 1];
      const ex = V[2 * c] - V[2 * a], ey = V[2 * c + 1] - V[2 * a + 1];
      const d2 = dx * dx + dy * dy;
      if (d2 === 0) continue;
      const x = (ex * dx + ey * dy) / d2;
      const y = (ey * dx - ex * dy) / d2;
      const la = local[a], lb = local[b], lc = local[c];
      idx.set([2 * la, 2 * la + 1, 2 * lb, 2 * lb + 1, 2 * lc, 2 * lc + 1]);
      // The miss in x, then in y, as coefficients on (ax, ay, bx, by, cx, cy).
      for (const r of [[-(1 - x), -y, -x, y, 1, 0], [y, -(1 - x), -y, -x, 0, 1]]) {
        coef.set(r);
        for (let i = 0; i < 6; i++) {
          for (let j = 0; j <= i; j++) if (coef[i] !== 0 && coef[j] !== 0) addSymmetric(rows, idx[i], idx[j], coef[i] * coef[j]);
        }
      }
    }
  }
  return rows;
}

/** Step two's energy: every triangle edge kept as its fitted copy has it. */
function edgeEnergy(mesh: ArapMesh, tris: number[], local: Int32Array, n: number): SymmetricRows {
  const rows = symmetricRows(n);
  const T = mesh.triangles;
  for (const t of tris) {
    for (let e = 0; e < 3; e++) {
      const i = local[T[3 * t + e]], j = local[T[3 * t + (e + 1) % 3]];
      addSymmetric(rows, i, i, 1);
      addSymmetric(rows, j, j, 1);
      addSymmetric(rows, i, j, -1);
    }
  }
  return rows;
}

function solveSplit(s: Split, fixedValue: (u: number) => number, b: Float64Array): Float64Array {
  for (let f = 0; f < s.coupling.length; f++) {
    const { at, by } = s.coupling[f];
    for (let k = 0; k < at.length; k++) b[f] -= by[k] * fixedValue(at[k]);
  }
  return s.factored.solve(b);
}

/** One connected piece of the mesh holding at least two pins. */
interface Piece {
  verts: Int32Array;
  tris: number[];
  /** Local vertex index → pin index, or -1 when free. */
  pinOf: Int32Array;
  freeOf: Int32Array;
  step1: Split;
  step2: Split;
}

function buildPiece(mesh: ArapMesh, verts: number[], tris: number[], pinAt: Map<number, number>, local: Int32Array): Piece | null {
  const n = verts.length;
  verts.forEach((v, i) => { local[v] = i; });
  const pinOf = Int32Array.from(verts, (v) => pinAt.get(v) ?? -1);
  const freeOf = new Int32Array(n).fill(-1);
  let nf = 0;
  for (let i = 0; i < n; i++) if (pinOf[i] < 0) freeOf[i] = nf++;
  const free2 = Int32Array.from({ length: 2 * n }, (_, u) => (freeOf[u >> 1] < 0 ? -1 : 2 * freeOf[u >> 1] + (u & 1)));
  const step1 = split(similarityEnergy(mesh, tris, local, n), (u) => free2[u] >= 0, free2);
  const step2 = split(edgeEnergy(mesh, tris, local, n), (u) => freeOf[u] >= 0, freeOf);
  return step1 && step2 ? { verts: Int32Array.from(verts), tris, pinOf, freeOf, step1, step2 } : null;
}

function solvePiece(mesh: ArapMesh, piece: Piece, local: Int32Array, targets: ArrayLike<number>, out: Float64Array): void {
  const { verts, pinOf, freeOf, step1, step2 } = piece;
  const n = verts.length;
  verts.forEach((v, i) => { local[v] = i; });
  const pinned = (i: number, c: number) => targets[2 * pinOf[i] + c];
  const x1 = solveSplit(step1, (u) => pinned(u >> 1, u & 1), new Float64Array(step1.coupling.length));
  const at1 = (i: number, c: number) => (pinOf[i] >= 0 ? pinned(i, c) : x1[2 * freeOf[i] + c]);
  // Fit a turned, unscaled copy of each rest triangle to step one's.
  const nf = step2.coupling.length;
  const bx = new Float64Array(nf), by = new Float64Array(nf);
  const V = mesh.vertices, T = mesh.triangles;
  for (const t of piece.tris) {
    const ids = [local[T[3 * t]], local[T[3 * t + 1]], local[T[3 * t + 2]]];
    const g = [T[3 * t], T[3 * t + 1], T[3 * t + 2]];
    let pcx = 0, pcy = 0, qcx = 0, qcy = 0;
    for (let k = 0; k < 3; k++) {
      pcx += V[2 * g[k]]; pcy += V[2 * g[k] + 1]; qcx += at1(ids[k], 0); qcy += at1(ids[k], 1);
    }
    pcx /= 3; pcy /= 3; qcx /= 3; qcy /= 3;
    let dot = 0, cross = 0;
    for (let k = 0; k < 3; k++) {
      const px = V[2 * g[k]] - pcx, py = V[2 * g[k] + 1] - pcy;
      const qx = at1(ids[k], 0) - qcx, qy = at1(ids[k], 1) - qcy;
      dot += px * qx + py * qy;
      cross += px * qy - py * qx;
    }
    const len = Math.hypot(dot, cross);
    const cos = len === 0 ? 1 : dot / len, sin = len === 0 ? 0 : cross / len;
    for (let e = 0; e < 3; e++) {
      const i = ids[e], j = ids[(e + 1) % 3];
      const ex = V[2 * g[e]] - V[2 * g[(e + 1) % 3]], ey = V[2 * g[e] + 1] - V[2 * g[(e + 1) % 3] + 1];
      const fx = cos * ex - sin * ey, fy = sin * ex + cos * ey;
      if (freeOf[i] >= 0) { bx[freeOf[i]] += fx; by[freeOf[i]] += fy; }
      if (freeOf[j] >= 0) { bx[freeOf[j]] -= fx; by[freeOf[j]] -= fy; }
    }
  }
  const x2 = solveSplit(step2, (u) => pinned(u, 0), bx);
  const y2 = solveSplit(step2, (u) => pinned(u, 1), by);
  for (let i = 0; i < n; i++) {
    const v = verts[i];
    out[2 * v] = pinOf[i] >= 0 ? pinned(i, 0) : x2[freeOf[i]];
    out[2 * v + 1] = pinOf[i] >= 0 ? pinned(i, 1) : y2[freeOf[i]];
  }
}

/** The mesh's connected pieces: vertex lists and triangle lists. */
function piecesOf(mesh: ArapMesh): { verts: number[]; tris: number[] }[] {
  const n = mesh.vertices.length >> 1;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const T = mesh.triangles;
  for (let t = 0; t + 2 < T.length; t += 3) {
    parent[find(T[t + 1])] = find(T[t]);
    parent[find(T[t + 2])] = find(T[t]);
  }
  const byRoot = new Map<number, { verts: number[]; tris: number[] }>();
  const used = new Uint8Array(n);
  for (let t = 0; t + 2 < T.length; t += 3) {
    const r = find(T[t]);
    let p = byRoot.get(r);
    if (!p) { p = { verts: [], tris: [] }; byRoot.set(r, p); }
    p.tris.push(t / 3);
    for (let k = 0; k < 3; k++) if (!used[T[t + k]]) { used[T[t + k]] = 1; p.verts.push(T[t + k]); }
  }
  return [...byRoot.values()];
}

/** The rigid motion best carrying `from` points onto `to` points. */
function rigidFit(from: readonly number[], to: ArrayLike<number>): (x: number, y: number) => [number, number] {
  const k = from.length >> 1;
  let pcx = 0, pcy = 0, qcx = 0, qcy = 0;
  for (let i = 0; i < k; i++) { pcx += from[2 * i]; pcy += from[2 * i + 1]; qcx += to[2 * i]; qcy += to[2 * i + 1]; }
  pcx /= k; pcy /= k; qcx /= k; qcy /= k;
  let dot = 0, cross = 0;
  for (let i = 0; i < k; i++) {
    const px = from[2 * i] - pcx, py = from[2 * i + 1] - pcy;
    const qx = to[2 * i] - qcx, qy = to[2 * i + 1] - qcy;
    dot += px * qx + py * qy; cross += px * qy - py * qx;
  }
  const len = Math.hypot(dot, cross);
  const cos = len === 0 ? 1 : dot / len, sin = len === 0 ? 0 : cross / len;
  return (x, y) => [cos * (x - pcx) - sin * (y - pcy) + qcx, sin * (x - pcx) + cos * (y - pcy) + qcy];
}

/**
 * Factor the deformation of `mesh` with vertices `pinned` held. A piece of
 * the mesh holding two pins or more deforms as rigidly as they allow; one
 * holding a single pin moves with it; one holding none moves rigidly with the
 * pins as a whole.
 */
export function createArapSolver(mesh: ArapMesh, pinned: readonly number[]): ArapSolver {
  const n = mesh.vertices.length >> 1;
  const pinAt = new Map<number, number>();
  pinned.forEach((v, k) => { if (!pinAt.has(v)) pinAt.set(v, k); });
  const local = new Int32Array(n);
  const pinFrom = pinned.flatMap((v) => [mesh.vertices[2 * v], mesh.vertices[2 * v + 1]]);
  const solved: Piece[] = [];
  const carried: { verts: number[]; pin: number }[] = [];
  for (const p of piecesOf(mesh)) {
    const pins = [...new Set(p.verts.filter((v) => pinAt.has(v)).map((v) => pinAt.get(v)!))];
    const piece = pins.length >= 2 ? buildPiece(mesh, p.verts, p.tris, pinAt, local) : null;
    if (piece) solved.push(piece);
    else carried.push({ verts: p.verts, pin: pins.length === 1 ? pins[0] : -1 });
  }
  return {
    solve(targets) {
      const out = Float64Array.from(mesh.vertices);
      for (const piece of solved) solvePiece(mesh, piece, local, targets, out);
      const whole = carried.some((c) => c.pin < 0) && pinned.length > 0 ? rigidFit(pinFrom, targets) : null;
      for (const { verts, pin } of carried) {
        for (const v of verts) {
          const x = mesh.vertices[2 * v], y = mesh.vertices[2 * v + 1];
          if (pin >= 0) {
            out[2 * v] = x + targets[2 * pin] - pinFrom[2 * pin];
            out[2 * v + 1] = y + targets[2 * pin + 1] - pinFrom[2 * pin + 1];
          } else if (whole) {
            [out[2 * v], out[2 * v + 1]] = whole(x, y);
          }
        }
      }
      return out;
    },
  };
}
