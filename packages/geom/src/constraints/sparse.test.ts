import { describe, expect, it } from 'vitest';
import { NormalSystem } from './sparse';

/** `(J M Jᵀ + λI) y = b` solved densely, the reference the sparse solve must match. */
function dense(rows: number[][], cols: number[][], vals: number[][], mobility: number[], lambda: number, b: number[]): number[] {
  const m = rows.length;
  const a = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  for (let p = 0; p < m; p++) {
    for (let q = 0; q < m; q++) {
      let s = 0;
      cols[p].forEach((v, i) => {
        const k = cols[q].indexOf(v);
        if (k >= 0) s += vals[p][i] * mobility[v] * vals[q][k];
      });
      a[p][q] = s + (p === q ? lambda : 0);
    }
  }
  const y = [...b];
  const mat = a.map((r) => [...r]);
  for (let c = 0; c < m; c++) {
    for (let r = c + 1; r < m; r++) {
      const f = mat[r][c] / mat[c][c];
      for (let k = c; k < m; k++) mat[r][k] -= f * mat[c][k];
      y[r] -= f * y[c];
    }
  }
  for (let r = m - 1; r >= 0; r--) {
    for (let k = r + 1; k < m; k++) y[r] -= mat[r][k] * y[k];
    y[r] /= mat[r][r];
  }
  return y;
}

describe('NormalSystem', () => {
  it('solves the damped normal equations the dense way does, rows shuffled out of band order', () => {
    // Six rows over eight variables, linked as a ring through shared variables.
    const cols = [[0, 1, 6], [6, 7], [2, 3, 0], [4, 5, 2], [7, 4], [1, 3, 5]];
    const vals = cols.map((c, p) => c.map((v) => Math.sin(p * 3.1 + v * 1.7) + 0.2 * (v + 1)));
    const mobility = [1, 1, 0.5, 1, 1e-3, 1, 1, 2];
    const b = [1, -2, 0.5, 3, -1, 0.25];
    const sys = new NormalSystem(cols.map((c) => Int32Array.from(c)), Float64Array.from(mobility));
    vals.forEach((row, p) => row.forEach((d, i) => sys.add(p, cols[p][i], d)));
    const y = sys.solve(Float64Array.from(b), 1e-3);
    const want = dense(cols.map((_, p) => [p]), cols, vals, mobility, 1e-3, b);
    expect(y).not.toBeNull();
    y!.forEach((v, p) => expect(v).toBeCloseTo(want[p], 9));
  });

  it('answers the minimum-norm step M Jᵀ y', () => {
    const sys = new NormalSystem([Int32Array.from([0, 1])], Float64Array.from([1, 2]));
    sys.add(0, 0, 3);
    sys.add(0, 1, 4);
    const y = sys.solve(Float64Array.from([5]), 0)!;
    const step = sys.step(y);
    // y = 5 / (9 + 32); step = -M Jᵀ y.
    expect(step[0]).toBeCloseTo(-3 * (5 / 41), 12);
    expect(step[1]).toBeCloseTo(-8 * (5 / 41), 12);
  });
});
