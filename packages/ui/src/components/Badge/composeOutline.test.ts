import { describe, expect, it } from 'vitest';
import { inwardReach } from './composeOutline';
import { polygonSampler } from './bases/polygonSampler';

describe('inwardReach', () => {
  const BOX = { w: 80, h: 24 };
  const square = polygonSampler([[0, 0], [100, 0], [100, 100], [0, 100]], 80, 24);

  it('is nothing for an outline nothing moves, or moves only outward', () => {
    expect(inwardReach(square, undefined, 0, BOX)).toBe(0);
    expect(inwardReach(square, [], 3, BOX)).toBe(0);
    expect(inwardReach(square, [{ type: 'spikes' }], 0, BOX)).toBe(0);
    expect(inwardReach(square, [{ type: 'bevel' }], 0, BOX)).toBe(0);
  });

  it('is a negative bloat', () => {
    expect(inwardReach(square, undefined, -3, BOX)).toBeCloseTo(3, 6);
  });

  it('is the depth of the deepest bite, to within the sampling', () => {
    const reach = inwardReach(square, [{ type: 'bites', params: { biteRadius: 4, biteSpacing: 12 } }], 0, BOX);
    expect(reach).toBeGreaterThan(3.5);
    expect(reach).toBeLessThanOrEqual(4);
  });

  it('adds an inward effect to a negative bloat, and takes an outward bloat off it', () => {
    const bites = [{ type: 'bites' as const, params: { biteRadius: 4, biteSpacing: 12 } }];
    expect(inwardReach(square, bites, -2, BOX)).toBeGreaterThan(5.5);
    expect(inwardReach(square, bites, 4, BOX)).toBe(0);
  });

  it('counts a point moved outward across a notch narrower than it moves', () => {
    const box = { w: 100, h: 100 };
    const notched = polygonSampler([[0, 0], [49, 0], [49, 50], [51, 50], [51, 0], [100, 0], [100, 100], [0, 100]], 100, 100);
    expect(inwardReach(notched, undefined, 1.5, box)).toBe(0);
    expect(inwardReach(notched, undefined, 3, box)).toBeCloseTo(3, 6);
  });
});
