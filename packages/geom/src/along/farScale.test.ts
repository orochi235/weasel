import { describe, expect, it } from 'vitest';
import { segmentLength } from '../paths/segmentLength';
import { arcLookup } from './arcLookup';
import { bezierDirection } from './bezier';

const K = 0.5522847498;
const quarter = [100, 0, 100, 100 * K, 100 * K, 100, 0, 100];

describe('a curve at either end of the double range', () => {
  for (const scale of [1e-160, 1e160]) {
    const c = quarter.map((v) => v * scale);

    it(`measures its arc at ${scale} the same as at 1`, () => {
      const lk = arcLookup(c, 2);
      expect(lk.s[16] / scale).toBeCloseTo(segmentLength(quarter, 2), 6);
    });

    it(`has a direction at ${scale}`, () => {
      for (const t of [0, 0.5, 1]) {
        const d = bezierDirection(c, 2, t);
        expect(d).not.toBeNull();
        expect(Math.hypot(...d!)).toBeCloseTo(1, 12);
      }
    });
  }
});
