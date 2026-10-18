/** Affine subspaces ("flats") over plain number arrays, in any dimension:
 *  the points, lines and planes a snap resolves against. */

export type Vec = readonly number[];

/** The affine subspace `at + span(dirs)`. `dirs` need not be orthonormal or
 *  independent; a zero or repeated direction adds nothing. */
export interface Flat {
  at: Vec;
  dirs: readonly Vec[];
}

/** A direction left with less than this fraction of its length after the
 *  ones before it are taken out counts as dependent on them. */
const RANK_TOL = 1e-9;
/** Pivots below this fraction of the largest diagonal entry count as zero. */
const PIVOT_TOL = 1e-12;

function dotv(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normv(a: Vec): number {
  return Math.sqrt(dotv(a, a));
}

function isFiniteVec(a: Vec): boolean {
  return a.every(Number.isFinite);
}

/** An orthonormal basis of `span(vecs)`, built by Gram-Schmidt with a second
 *  pass for stability. Non-finite and dependent vectors are dropped. */
export function orthonormalize(vecs: readonly Vec[], start: readonly Vec[] = []): number[][] {
  const basis: number[][] = start.map((q) => q.slice());
  const out: number[][] = [];
  for (const d of vecs) {
    const n0 = normv(d);
    if (!(n0 > 0) || !isFiniteVec(d)) continue;
    const v = d.slice();
    for (let pass = 0; pass < 2; pass++) {
      for (const q of basis) {
        const k = dotv(v, q);
        for (let i = 0; i < v.length; i++) v[i] -= k * q[i];
      }
    }
    const n = normv(v);
    if (n <= RANK_TOL * n0) continue;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    basis.push(v);
    out.push(v);
  }
  return out;
}

/** An orthonormal basis of the orthogonal complement of the orthonormal `basis` in R^n. */
function complement(basis: readonly Vec[], n: number): number[][] {
  const axes: number[][] = [];
  for (let i = 0; i < n; i++) axes.push(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  return orthonormalize(axes, basis);
}

/** The flat's dimension: the rank of its directions. */
export function flatDim(f: Flat): number {
  return orthonormalize(f.dirs).length;
}

/** The point of `f` nearest `p`. */
export function closestOnFlat(f: Flat, p: Vec): Vec {
  const out = f.at.slice();
  for (const q of orthonormalize(f.dirs)) {
    let k = 0;
    for (let i = 0; i < q.length; i++) k += q[i] * (p[i] - f.at[i]);
    for (let i = 0; i < out.length; i++) out[i] += k * q[i];
  }
  return out;
}

/**
 * The `x` minimizing `|Σ x_j cols_j − rhs|`, through the normal equations.
 * A rank-deficient system has many minimizers; this returns the one whose
 * free unknowns are zero.
 */
export function solveLeastSquares(cols: readonly Vec[], rhs: Vec): number[] {
  const k = cols.length;
  const m = cols.map((a) => [...cols.map((b) => dotv(a, b)), dotv(a, rhs)]);
  let maxDiag = 0;
  for (let i = 0; i < k; i++) maxDiag = Math.max(maxDiag, Math.abs(m[i][i]));
  const tol = PIVOT_TOL * (maxDiag || 1);
  const pivots: [row: number, col: number][] = [];
  let row = 0;
  for (let col = 0; col < k && row < k; col++) {
    let best = row;
    for (let r = row + 1; r < k; r++) if (Math.abs(m[r][col]) > Math.abs(m[best][col])) best = r;
    if (!(Math.abs(m[best][col]) > tol)) continue;
    [m[row], m[best]] = [m[best], m[row]];
    for (let r = row + 1; r < k; r++) {
      const f = m[r][col] / m[row][col];
      for (let c = col; c <= k; c++) m[r][c] -= f * m[row][c];
    }
    pivots.push([row, col]);
    row++;
  }
  const x = new Array<number>(k).fill(0);
  for (let p = pivots.length - 1; p >= 0; p--) {
    const [r, col] = pivots[p];
    let s = m[r][k];
    for (let c = col + 1; c < k; c++) s -= m[r][c] * x[c];
    x[col] = s / m[r][col];
  }
  return x;
}

/** The nearest pair of points, one on each flat. Parallel flats have many
 *  such pairs; this returns one of them. */
export function closestBetweenFlats(a: Flat, b: Flat): { onA: Vec; onB: Vec } {
  const qa = orthonormalize(a.dirs);
  const qb = orthonormalize(b.dirs);
  const d = b.at.map((v, i) => v - a.at[i]);
  const x = solveLeastSquares([...qa, ...qb.map((q) => q.map((v) => -v))], d);
  const onA = a.at.slice();
  const onB = b.at.slice();
  qa.forEach((q, j) => q.forEach((v, i) => { onA[i] += x[j] * v; }));
  qb.forEach((q, j) => q.forEach((v, i) => { onB[i] += x[qa.length + j] * v; }));
  return { onA, onB };
}

/** `a ∩ b`, or null when they miss each other by more than `eps`. */
export function intersectFlats(a: Flat, b: Flat, eps = 1e-6): Flat | null {
  const { onA, onB } = closestBetweenFlats(a, b);
  let gap2 = 0;
  for (let i = 0; i < onA.length; i++) gap2 += (onA[i] - onB[i]) ** 2;
  if (!(Math.sqrt(gap2) <= eps) || !isFiniteVec(onA)) return null;
  const n = a.at.length;
  const normals = orthonormalize([
    ...complement(orthonormalize(a.dirs), n),
    ...complement(orthonormalize(b.dirs), n),
  ]);
  return { at: onA, dirs: complement(normals, n) };
}
