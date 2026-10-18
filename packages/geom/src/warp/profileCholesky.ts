/**
 * Sparse symmetric positive-definite solves for mesh systems: the unknowns
 * reordered by reverse Cuthill–McKee so each row's nonzeros sit close to the
 * diagonal, then a Cholesky factor stored by profile (each row from its first
 * nonzero to the diagonal). Factoring costs the sum of the squared row widths
 * and a solve the profile's size, which for a mesh of n vertices is about
 * n·√n — small enough to factor once and re-solve every frame.
 */

/** A symmetric matrix under assembly: `rows[i]` maps a column `j <= i` to its entry. */
export type SymmetricRows = Map<number, number>[];

/** `n` empty rows. */
export function symmetricRows(n: number): SymmetricRows {
  return Array.from({ length: n }, () => new Map<number, number>());
}

/** Add `v` at `(i, j)` and, implicitly, `(j, i)`. */
export function addSymmetric(rows: SymmetricRows, i: number, j: number, v: number): void {
  const [r, c] = i >= j ? [i, j] : [j, i];
  const row = rows[r];
  row.set(c, (row.get(c) ?? 0) + v);
}

/** A factored matrix. `solve` returns `x` with `A x = b`. */
export interface Factored {
  solve(b: ArrayLike<number>): Float64Array;
}

/** Reverse Cuthill–McKee over the matrix's graph: `order[k]` is the old index placed at `k`. */
function reverseCuthillMcKee(rows: SymmetricRows): Int32Array {
  const n = rows.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  rows.forEach((row, i) => row.forEach((_, j) => {
    if (j !== i) { adj[i].push(j); adj[j].push(i); }
  }));
  const degree = adj.map((a) => a.length);
  const seen = new Uint8Array(n);
  const order: number[] = [];
  const byDegree = [...Array(n).keys()].sort((a, b) => degree[a] - degree[b]);
  for (const root of byDegree) {
    if (seen[root]) continue;
    seen[root] = 1;
    const queue = [root];
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head];
      order.push(v);
      const next = adj[v].filter((w) => !seen[w]).sort((a, b) => degree[a] - degree[b]);
      for (const w of next) { seen[w] = 1; queue.push(w); }
    }
  }
  return Int32Array.from(order.reverse());
}

/**
 * Factor the symmetric positive-definite matrix `rows`. Null when it is not
 * positive definite — a system with too few constraints to fix its solution.
 */
export function factorSymmetric(rows: SymmetricRows): Factored | null {
  const n = rows.length;
  const order = reverseCuthillMcKee(rows);
  const at = new Int32Array(n);
  order.forEach((old, k) => { at[old] = k; });
  // Profile: row k holds columns first[k]..k, at offset start[k].
  const first = Int32Array.from({ length: n }, (_, k) => k);
  rows.forEach((row, i) => row.forEach((_, j) => {
    const a = at[i], b = at[j];
    const r = Math.max(a, b), c = Math.min(a, b);
    if (c < first[r]) first[r] = c;
  }));
  const start = new Int32Array(n + 1);
  for (let k = 0; k < n; k++) start[k + 1] = start[k] + (k - first[k] + 1);
  const L = new Float64Array(start[n]);
  rows.forEach((row, i) => row.forEach((v, j) => {
    const a = at[i], b = at[j];
    const r = Math.max(a, b), c = Math.min(a, b);
    L[start[r] + c - first[r]] += v;
  }));
  for (let i = 0; i < n; i++) {
    const fi = first[i], si = start[i];
    for (let j = fi; j <= i; j++) {
      const fj = first[j], sj = start[j];
      let sum = L[si + j - fi];
      for (let k = Math.max(fi, fj); k < j; k++) sum -= L[si + k - fi] * L[sj + k - fj];
      if (j === i) {
        if (!(sum > 0)) return null;
        L[si + i - fi] = Math.sqrt(sum);
      } else {
        L[si + j - fi] = sum / L[sj + j - fj];
      }
    }
  }
  return {
    solve(b) {
      const y = new Float64Array(n);
      for (let k = 0; k < n; k++) y[k] = b[order[k]];
      for (let i = 0; i < n; i++) {
        const fi = first[i], si = start[i];
        let sum = y[i];
        for (let k = fi; k < i; k++) sum -= L[si + k - fi] * y[k];
        y[i] = sum / L[si + i - fi];
      }
      for (let i = n - 1; i >= 0; i--) {
        const fi = first[i], si = start[i];
        y[i] /= L[si + i - fi];
        const yi = y[i];
        for (let k = fi; k < i; k++) y[k] -= L[si + k - fi] * yi;
      }
      const x = new Float64Array(n);
      for (let k = 0; k < n; k++) x[order[k]] = y[k];
      return x;
    },
  };
}
