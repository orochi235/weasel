import { describe, expect, it } from 'vitest';
import { inwardReach } from './composeOutline';
import { polygonSampler } from './bases/polygonSampler';

describe('inwardReach', () => {
  const square = polygonSampler([[0, 0], [100, 0], [100, 100], [0, 100]], 80, 24);

  it('is nothing for an outline nothing moves, or moves only outward', () => {
    expect(inwardReach(square, undefined, 0)).toBe(0);
    expect(inwardReach(square, [], 3)).toBe(0);
    expect(inwardReach(square, [{ type: 'spikes' }], 0)).toBe(0);
    expect(inwardReach(square, [{ type: 'bevel' }], 0)).toBe(0);
  });

  it('is a negative bloat', () => {
    expect(inwardReach(square, undefined, -3)).toBeCloseTo(3, 6);
  });

  it('is the depth of the deepest bite, to within the sampling', () => {
    const reach = inwardReach(square, [{ type: 'bites', params: { biteRadius: 4, biteSpacing: 12 } }], 0);
    expect(reach).toBeGreaterThan(3.5);
    expect(reach).toBeLessThanOrEqual(4);
  });

  it('adds an inward effect to a negative bloat, and takes an outward bloat off it', () => {
    const bites = [{ type: 'bites' as const, params: { biteRadius: 4, biteSpacing: 12 } }];
    expect(inwardReach(square, bites, -2)).toBeGreaterThan(5.5);
    expect(inwardReach(square, bites, 4)).toBe(0);
  });
});
