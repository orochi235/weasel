import { describe, expect, it } from 'vitest';
import { frameAt, residualRows, writeResiduals } from './residuals';
import type { PathConstraint } from './types';

/** Central differences of `c`'s residual rows over every coordinate of `x`. */
function numeric(c: PathConstraint, x: Float64Array, angle: number): number[][] {
  const rows = residualRows(c);
  const frame = frameAt(angle);
  const out = Array.from({ length: rows }, () => new Array<number>(x.length).fill(0));
  const plus = new Float64Array(rows);
  const minus = new Float64Array(rows);
  for (let v = 0; v < x.length; v++) {
    const keep = x[v];
    x[v] = keep + 1e-6;
    writeResiduals(c, x, frame, plus, 0);
    x[v] = keep - 1e-6;
    writeResiduals(c, x, frame, minus, 0);
    x[v] = keep;
    for (let k = 0; k < rows; k++) out[k][v] = (plus[k] - minus[k]) / 2e-6;
  }
  return out;
}

function analytic(c: PathConstraint, x: Float64Array, angle: number): number[][] {
  const out = Array.from({ length: residualRows(c) }, () => new Array<number>(x.length).fill(0));
  writeResiduals(c, x, frameAt(angle), new Float64Array(out.length), 0, (row, v, d) => {
    out[row][v] += d;
  });
  return out;
}

const KINDS: PathConstraint[] = [
  { kind: 'horizontal', segment: [0, 1] },
  { kind: 'vertical', segment: [1, 2] },
  { kind: 'length', segment: [0, 2], length: 40 },
  { kind: 'coincident', anchors: [3, 1] },
  { kind: 'equalLength', segments: [[0, 1], [2, 3]] },
  { kind: 'parallel', segments: [[0, 1], [2, 3]] },
  { kind: 'perpendicular', segments: [[0, 1], [1, 2]] },
];

describe('writeResiduals derivatives', () => {
  const x = Float64Array.from([3, -2, 97, 11, 40, 63, -18, 75]);
  for (const c of KINDS) {
    it(`match central differences for ${c.kind}`, () => {
      const want = numeric(c, x, 0.3);
      const got = analytic(c, x, 0.3);
      got.forEach((row, k) => row.forEach((d, v) => expect(d).toBeCloseTo(want[k][v], 5)));
    });
  }
});
