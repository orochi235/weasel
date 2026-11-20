import { describe, it, expect } from 'vitest';
import { anchorParamsBetween } from './anchorParams';

describe('anchorParamsBetween', () => {
  it('interpolates t between points on the same anchor pair', () => {
    expect(anchorParamsBetween(0, 1, 0.2, 0, 1, 0.6, 0.5)).toEqual([0, 1, expect.closeTo(0.4)]);
  });

  it('blends between two anchor-aligned points', () => {
    expect(anchorParamsBetween(0, 0, 0, 1, 1, 0, 0.3)).toEqual([0, 1, expect.closeTo(0.3)]);
    expect(anchorParamsBetween(3, 3, 0, 0, 0, 0, 0.7)).toEqual([3, 0, expect.closeTo(0.7)]);
  });

  it("blends from a run's anchor to its first interior point, and from its last to the anchor", () => {
    expect(anchorParamsBetween(2, 2, 0, 2, 3, 0.4, 0.5)).toEqual([2, 3, expect.closeTo(0.2)]);
    expect(anchorParamsBetween(2, 3, 0.6, 3, 3, 0, 0.5)).toEqual([2, 3, expect.closeTo(0.8)]);
  });

  it('takes the nearer point between unrelated pairs', () => {
    expect(anchorParamsBetween(0, 1, 0.5, 4, 5, 0.5, 0.3)).toEqual([0, 1, 0.5]);
    expect(anchorParamsBetween(0, 1, 0.5, 4, 5, 0.5, 0.7)).toEqual([4, 5, 0.5]);
  });

  it('keeps a point its own parameters when the cut lands on it', () => {
    expect(anchorParamsBetween(1, 1, 0, 2, 2, 0, 0)).toEqual([1, 1, 0]);
    expect(anchorParamsBetween(1, 1, 0, 2, 2, 0, 1)).toEqual([2, 2, 0]);
  });
});
