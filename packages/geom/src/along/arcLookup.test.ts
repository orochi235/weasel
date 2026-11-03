import { describe, expect, it } from 'vitest';
import { segmentLength, segmentTAtLength } from '../paths/segmentLength';
import { arcLookup, lookupLength, lookupT } from './arcLookup';
import { bezierPoint } from './bezier';

const K = 0.5522847498;
const quarter = [100, 0, 100, 100 * K, 100 * K, 100, 0, 100];

const cases: [string, number[], 2 | 3][] = [
  ['quarter', quarter, 2],
  ['symmetric', [0, 0, 0, 100, 100, 100, 100, 0], 2],
  ['cusp', [0, 0, 100, 100, 0, 100, 100, 0], 2],
  ['near cusp', [0, 0, 100, 100, 0, 100.5, 100, 0], 2],
  ['cusp at 0.752', [0, 0, 100, 100, 0, 100, 55.081485, 89.124038], 2],
  ['shoulder', [0, 0, 100, 100, -50, 40, 92.62712165, 87.5312398], 2],
  ['loop', [0, 0, 150, 100, -50, 100, 100, 0], 2],
  ['quadratic', [0, 0, 50, 100, 100, 0], 2],
  ['tight', [0, 0, 400, -300, -300, 300, 100, 0], 2],
  ['twisted', [0, 0, 0, 100, 0, 50, 0, 100, -80, 100, 100, 100], 3],
];

describe('arcLookup', () => {
  it('answers the point the whole-segment solve does, within 1e-6', () => {
    for (const [name, c, dim] of cases) {
      const lk = arcLookup(c, dim);
      const total = segmentLength(c, dim);
      expect(Math.abs(lk.s[16] - total) / total, name).toBeLessThan(1e-10);
      for (let i = 1; i < 400; i++) {
        const s = (i / 400) * total;
        const a = bezierPoint(c, dim, lookupT(c, dim, lk, s));
        const b = bezierPoint(c, dim, segmentTAtLength(c, dim, s, total));
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), `${name} at ${i}/400`).toBeLessThan(1e-6);
        expect(Math.abs(lookupLength(c, dim, lk, segmentTAtLength(c, dim, s, total)) - s), `${name} length at ${i}/400`)
          .toBeLessThan(1e-6);
      }
    }
  });

  it('clamps to the ends', () => {
    const lk = arcLookup(quarter, 2);
    expect(lookupT(quarter, 2, lk, -1)).toBe(0);
    expect(lookupT(quarter, 2, lk, 1e9)).toBe(1);
  });

  it('answers 0 on a segment whose coordinates are not finite', () => {
    const c = [0, 0, NaN, 1, 2, 2, 3, 0];
    expect(lookupT(c, 2, arcLookup(c, 2), 1)).toBe(0);
  });
});
