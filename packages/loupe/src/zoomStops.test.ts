import { describe, expect, it } from 'vitest';
import { LOUPE_FACTOR_STOPS, nearestStopIndex } from './zoomStops';

describe('nearestStopIndex', () => {
  it('measures nearness in doublings', () => {
    expect(nearestStopIndex(LOUPE_FACTOR_STOPS, 3)).toBe(2);
    expect(nearestStopIndex(LOUPE_FACTOR_STOPS, 1000)).toBe(LOUPE_FACTOR_STOPS.length - 1);
  });

  it('refuses an empty list, which has no index to answer', () => {
    expect(() => nearestStopIndex([], 4)).toThrow(RangeError);
  });
});
