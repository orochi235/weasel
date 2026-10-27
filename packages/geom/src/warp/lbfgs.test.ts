import { describe, expect, it } from 'vitest';
import { descent, dot, stepMemory } from './lbfgs';

// The two-loop recursion as written down, the preconditioner applied to the middle vector.
function reference(
  pairs: { s: Float64Array; y: Float64Array }[], g: Float64Array, P: (q: Float64Array) => Float64Array, scale: number,
): Float64Array {
  const q = Float64Array.from(g);
  const alpha: number[] = [];
  for (let k = pairs.length - 1; k >= 0; k--) {
    const { s, y } = pairs[k];
    const a = dot(s, q) / dot(s, y);
    alpha[k] = a;
    q.forEach((_, j) => { q[j] -= a * y[j]; });
  }
  const r = P(q).map((v) => v * scale);
  for (let k = 0; k < pairs.length; k++) {
    const { s, y } = pairs[k];
    const c = alpha[k] - dot(y, r) / dot(s, y);
    r.forEach((_, j) => { r[j] += c * s[j]; });
  }
  return r.map((v) => -v);
}

describe('descent', () => {
  // A quadratic 0.5 x'Ax with a diagonal preconditioner that misjudges its scale.
  const A = [[4, 1, 0, 0, 0], [1, 3, 1, 0, 0], [0, 1, 5, 1, 0], [0, 0, 1, 2, 0.5], [0, 0, 0, 0.5, 6]];
  const grad = (x: Float64Array) => Float64Array.from(A, (row) => row.reduce((s, v, j) => s + v * x[j], 0));
  const P = (q: Float64Array) => q.map((v, i) => v / (2 * A[i][i]));

  it.each([false, true])('matches the textbook recursion over the steps it remembered (scaled: %s)', (scaled) => {
    const m = stepMemory();
    let x = Float64Array.from([1, -2, 0.5, 3, -1]);
    const pairs: { s: Float64Array; y: Float64Array }[] = [];
    for (let round = 0; round < 4; round++) {
      const g = grad(x);
      const d = descent(m, g, P, scaled);
      const last = pairs.at(-1);
      const scale = scaled && last ? dot(last.s, last.y) / dot(last.y, P(last.y)) : 1;
      reference(pairs, g, P, scale).forEach((v, j) => expect(d[j]).toBeCloseTo(v, 10));
      const step = d.map((v) => 0.5 * v);
      const next = x.map((v, j) => v + step[j]);
      pairs.push({ s: step, y: grad(next).map((v, j) => v - g[j]) });
      m.lastGrad = g;
      m.lastStep = step;
      x = next;
    }
  });
});
