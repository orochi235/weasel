import { describe, expect, it } from 'vitest';
import { frameAt, residualRows, writeResiduals, type ResidualSpace } from './residuals';
import type { PathConstraint } from './types';

/** Four anchors, then each anchor's in and out handle offsets. */
const spaceOf = (angle: number): ResidualSpace => ({ frame: frameAt(angle), count: 4 });

/** Central differences of `c`'s residual rows over every coordinate of `x`. */
/** The slot of an `onPath` constraint's parameter: just past the anchors and handles. */
const PARAM = 24;

function numeric(c: PathConstraint, x: Float64Array, angle: number): number[][] {
  const rows = residualRows(c);
  const space = spaceOf(angle);
  const out = Array.from({ length: rows }, () => new Array<number>(x.length).fill(0));
  const plus = new Float64Array(rows);
  const minus = new Float64Array(rows);
  for (let v = 0; v < x.length; v++) {
    const keep = x[v];
    x[v] = keep + 1e-6;
    writeResiduals(c, x, space, plus, 0, undefined, PARAM);
    x[v] = keep - 1e-6;
    writeResiduals(c, x, space, minus, 0, undefined, PARAM);
    x[v] = keep;
    for (let k = 0; k < rows; k++) out[k][v] = (plus[k] - minus[k]) / 2e-6;
  }
  return out;
}

function analytic(c: PathConstraint, x: Float64Array, angle: number): number[][] {
  const out = Array.from({ length: residualRows(c) }, () => new Array<number>(x.length).fill(0));
  writeResiduals(c, x, spaceOf(angle), new Float64Array(out.length), 0, (row, v, d) => {
    out[row][v] += d;
  }, PARAM);
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
  { kind: 'tangent', anchor: 2 },
  { kind: 'onPath', anchor: 3, segment: [1, 2] },
  { kind: 'onPath', anchor: 1, segment: [1, 2] },
];

describe('writeResiduals derivatives', () => {
  const x = Float64Array.from([
    3, -2, 97, 11, 40, 63, -18, 75,
    -20, 4, 30, 2, -11, 5, 9, 7, -25, -9, 31, 14, 6, -3, 4, 18,
    0.37,
  ]);
  for (const c of KINDS) {
    it(`match central differences for ${c.kind}`, () => {
      const want = numeric(c, x, 0.3);
      const got = analytic(c, x, 0.3);
      got.forEach((row, k) => row.forEach((d, v) => expect(d).toBeCloseTo(want[k][v], 5)));
    });
  }
});
