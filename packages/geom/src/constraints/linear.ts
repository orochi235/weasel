/**
 * Solve the dense `n × n` system `a · y = b` by Gaussian elimination with
 * partial pivoting. `a` is row-major and is overwritten, as is `b`. Returns
 * null when a pivot vanishes, which a damped system never produces.
 */
export function solveDense(a: Float64Array, b: Float64Array, n: number): Float64Array | null {
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row * n + col]) > Math.abs(a[pivot * n + col])) pivot = row;
    }
    const p = a[pivot * n + col];
    if (Math.abs(p) < 1e-300) return null;
    if (pivot !== col) {
      for (let k = 0; k < n; k++) {
        const t = a[col * n + k];
        a[col * n + k] = a[pivot * n + k];
        a[pivot * n + k] = t;
      }
      const t = b[col];
      b[col] = b[pivot];
      b[pivot] = t;
    }
    for (let row = col + 1; row < n; row++) {
      const f = a[row * n + col] / p;
      if (f === 0) continue;
      for (let k = col; k < n; k++) a[row * n + k] -= f * a[col * n + k];
      b[row] -= f * b[col];
    }
  }
  const y = new Float64Array(n);
  for (let row = n - 1; row >= 0; row--) {
    let s = b[row];
    for (let k = row + 1; k < n; k++) s -= a[row * n + k] * y[k];
    y[row] = s / a[row * n + row];
  }
  return y;
}
