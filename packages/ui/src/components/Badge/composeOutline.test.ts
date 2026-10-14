import { describe, expect, it } from 'vitest';
import { inwardReach } from './composeOutline';
import { polygonSampler } from './bases/polygonSampler';

describe('inwardReach', () => {
  const BOX = { w: 80, h: 24 };
  const HELD = { left: 8, top: 4, right: 72, bottom: 20 };
  const square = polygonSampler([[0, 0], [100, 0], [100, 100], [0, 100]], 80, 24);

  it('is nothing for an outline nothing moves, or moves only outward', () => {
    expect(inwardReach(square, undefined, 0, BOX, HELD)).toBe(0);
    expect(inwardReach(square, [], 3, BOX, HELD)).toBe(0);
    expect(inwardReach(square, [{ type: 'spikes' }], 0, BOX, HELD)).toBe(0);
    expect(inwardReach(square, [{ type: 'bevel' }], 0, BOX, HELD)).toBe(0);
  });

  it('is a negative bloat', () => {
    expect(inwardReach(square, undefined, -3, BOX, HELD)).toBeCloseTo(3, 6);
  });

  it('is the depth of the deepest bite, to within the sampling', () => {
    const reach = inwardReach(square, [{ type: 'bites', params: { biteRadius: 4, biteSpacing: 12 } }], 0, BOX, HELD);
    expect(reach).toBeGreaterThan(3.5);
    expect(reach).toBeLessThanOrEqual(4);
  });

  it('adds an inward effect to a negative bloat, and takes an outward bloat off it', () => {
    const bites = [{ type: 'bites' as const, params: { biteRadius: 4, biteSpacing: 12 } }];
    expect(inwardReach(square, bites, -2, BOX, HELD)).toBeGreaterThan(5.5);
    expect(inwardReach(square, bites, 4, BOX, HELD)).toBe(0);
  });

  describe('for a point moved outward across a notch narrower than it moves', () => {
    const box = { w: 100, h: 100 };
    const notched = polygonSampler([[0, 0], [49, 0], [49, 50], [51, 50], [51, 0], [100, 0], [100, 100], [0, 100]], 100, 100);

    it('counts one that lands on the content', () => {
      const beside = { left: 10, top: 10, right: 49, bottom: 90 };
      expect(inwardReach(notched, undefined, 1.5, box, beside)).toBe(0);
      expect(inwardReach(notched, undefined, 3, box, beside)).toBeCloseTo(3, 6);
    });

    it('counts none that lands inside the base and off the content', () => {
      const below = { left: 10, top: 55, right: 90, bottom: 90 };
      expect(inwardReach(notched, undefined, 3, box, below)).toBe(0);
    });
  });
});
