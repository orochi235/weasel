/**
 * The two linear systems an as-rigid-as-possible solve uses, assembled over
 * one piece of a mesh and split into free and pinned unknowns so that each is
 * factored once per pin set.
 */
import { addSymmetric, factorSymmetric, symmetricRows, type Factored, type SymmetricRows } from './profileCholesky';

/** A linear system split into its free and pinned unknowns. */
export interface Split {
  factored: Factored;
  /** For each free unknown, the pinned unknowns it couples to and by how much. */
  coupling: { at: Int32Array; by: Float64Array }[];
}

/** `full` split by `freeIndex`, an unknown's index among the free ones or -1 when pinned; null when singular. */
export function split(full: SymmetricRows, freeIndex: Int32Array): Split | null {
  const nFree = freeIndex.reduce((n, f) => (f >= 0 ? n + 1 : n), 0);
  const rows = symmetricRows(nFree);
  const coupling: { at: number[]; by: number[] }[] = Array.from({ length: nFree }, () => ({ at: [], by: [] }));
  full.forEach((row, i) => row.forEach((v, j) => {
    const fi = freeIndex[i] >= 0, fj = freeIndex[j] >= 0;
    if (fi && fj) addSymmetric(rows, freeIndex[i], freeIndex[j], v);
    else if (fi) { coupling[freeIndex[i]].at.push(j); coupling[freeIndex[i]].by.push(v); }
    else if (fj) { coupling[freeIndex[j]].at.push(i); coupling[freeIndex[j]].by.push(v); }
  }));
  const factored = factorSymmetric(rows);
  if (!factored) return null;
  return { factored, coupling: coupling.map((c) => ({ at: Int32Array.from(c.at), by: Float64Array.from(c.by) })) };
}

/** The free unknowns of `s` given the right side `b` (consumed) and each pinned unknown's value. */
export function solveSplit(s: Split, fixedValue: (u: number) => number, b: Float64Array): Float64Array {
  for (let f = 0; f < s.coupling.length; f++) {
    const { at, by } = s.coupling[f];
    for (let k = 0; k < at.length; k++) b[f] -= by[k] * fixedValue(at[k]);
  }
  return s.factored.solve(b);
}

/**
 * The similarity step's energy over `n` local vertices at `rest`, triangles
 * `tris` as local triples: each triangle vertex kept where its opposite edge,
 * turned and scaled, puts it. Unknowns are interleaved `x, y`.
 */
export function similarityEnergy(rest: Float64Array, tris: Int32Array, n: number): SymmetricRows {
  const rows = symmetricRows(2 * n);
  const coef = new Float64Array(6);
  const idx = new Int32Array(6);
  for (let t = 0; t < tris.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = tris[t + e], b = tris[t + (e + 1) % 3], c = tris[t + (e + 2) % 3];
      const dx = rest[2 * b] - rest[2 * a], dy = rest[2 * b + 1] - rest[2 * a + 1];
      const ex = rest[2 * c] - rest[2 * a], ey = rest[2 * c + 1] - rest[2 * a + 1];
      const d2 = dx * dx + dy * dy;
      if (d2 === 0) continue;
      const x = (ex * dx + ey * dy) / d2;
      const y = (ey * dx - ex * dy) / d2;
      idx.set([2 * a, 2 * a + 1, 2 * b, 2 * b + 1, 2 * c, 2 * c + 1]);
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

/** The rigid step's energy: every triangle edge kept as its fitted copy has it, one coordinate at a time. */
export function edgeEnergy(tris: Int32Array, n: number): SymmetricRows {
  const rows = symmetricRows(n);
  for (let t = 0; t < tris.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const i = tris[t + e], j = tris[t + (e + 1) % 3];
      addSymmetric(rows, i, i, 1);
      addSymmetric(rows, j, j, 1);
      addSymmetric(rows, i, j, -1);
    }
  }
  return rows;
}
