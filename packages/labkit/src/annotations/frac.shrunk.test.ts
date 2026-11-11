/** Shrunk counterexamples from `frac.pbt.test.ts`, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { toShape, worldToFrac } from './frac';

describe('a side too short to divide by', () => {
  it('reads as a share of 0 in a shape, not infinity', () => {
    expect(toShape([{ x: 8.881784197001252e-16, y: 0 }], { x: 0, y: 0, w: 5e-324, h: 0 })).toEqual([
      { x: 0, y: 0 },
    ]);
  });

  it('reads as a share of 0 of the content box, not NaN', () => {
    expect(worldToFrac({ x: 0, y: 0, width: 1, height: 0 }, { w: 5e-324, h: 5e-324 })).toEqual({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    });
  });
});
