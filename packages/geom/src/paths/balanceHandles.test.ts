import { describe, expect, it } from 'vitest';
import {
  balanceFactorToward,
  equalizeSegmentHandles,
  handleBalances,
  scaleSegmentHandles,
} from './balanceHandles';
import type { AnchorSet } from './anchorEdits';

/** One curved segment from (0, 0) to (100, 0) whose handles both lean up
 *  toward a corner at (50, 50), the first reaching 40% of the way there and
 *  the second 80%. */
function lopsided(): AnchorSet {
  return {
    anchors: [[
      { x: 0, y: 0, outHandle: { x: 20, y: 20 } },
      { x: 100, y: 0, inHandle: { x: 60, y: 40 }, outHandle: { x: 130, y: -30 } },
      { x: 200, y: 0 },
    ]],
    closed: [false],
  };
}

describe('handleBalances', () => {
  it('lists each curved segment with both handles out, gripped midway between the tips', () => {
    const lines = handleBalances(lopsided());
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ sub: 0, segIdx: 0, flat: 0, from: { x: 20, y: 20 }, to: { x: 60, y: 40 }, grip: { x: 40, y: 30 } });
  });
});

describe('scaleSegmentHandles', () => {
  it('scales both handles along their own directions and leaves the neighbors alone', () => {
    const set = lopsided();
    expect(scaleSegmentHandles(set, 0, 0, 1.5)).toBe(true);
    const [a, b] = set.anchors[0];
    expect(a.outHandle).toEqual({ x: 30, y: 30 });
    expect(b.inHandle).toEqual({ x: 40, y: 60 });
    expect(b.outHandle).toEqual({ x: 130, y: -30 });
  });

  it('holds at zero below it', () => {
    const set = lopsided();
    scaleSegmentHandles(set, 0, 0, -2);
    expect(set.anchors[0][0].outHandle).toEqual({ x: 0, y: 0 });
  });
});

describe('balanceFactorToward', () => {
  it('is the factor that carries the grip to a point along its slide', () => {
    const set = lopsided();
    // The grip slides from the chord's middle (50, 0) through (40, 30).
    expect(balanceFactorToward(set, 0, 0, { x: 40, y: 30 })).toBeCloseTo(1, 12);
    expect(balanceFactorToward(set, 0, 0, { x: 30, y: 60 })).toBeCloseTo(2, 12);
    expect(balanceFactorToward(set, 0, 0, { x: 60, y: -30 })).toBe(0);
  });
});

describe('equalizeSegmentHandles', () => {
  it('gives both handles the mean of their proportions toward the corner', () => {
    const set = lopsided();
    expect(equalizeSegmentHandles(set, 0, 0)).toBe(true);
    const [a, b] = set.anchors[0];
    // 40% and 80% meet at 60%: 0.6 of the way to (50, 50) from each end.
    expect(a.outHandle!.x).toBeCloseTo(30, 9);
    expect(a.outHandle!.y).toBeCloseTo(30, 9);
    expect(b.inHandle!.x).toBeCloseTo(70, 9);
    expect(b.inHandle!.y).toBeCloseTo(30, 9);
    expect(equalizeSegmentHandles(set, 0, 0)).toBe(false);
  });

  it('evens out the lengths where the handle lines never cross ahead', () => {
    const set: AnchorSet = {
      anchors: [[
        { x: 0, y: 0, outHandle: { x: 0, y: 20 } },
        { x: 100, y: 0, inHandle: { x: 100, y: 60 } },
      ]],
      closed: [false],
    };
    equalizeSegmentHandles(set, 0, 0);
    expect(set.anchors[0][0].outHandle).toEqual({ x: 0, y: 40 });
    expect(set.anchors[0][1].inHandle).toEqual({ x: 100, y: 40 });
  });
});
