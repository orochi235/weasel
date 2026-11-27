import { describe, expect, it } from 'vitest';
import { widenSlop } from './screenSlop';

describe('widenSlop', () => {
  it('reads a world slop at the magnitude of a flipped scale', () => {
    expect(widenSlop(1, 4, -2)).toBe(3);
    expect(widenSlop(undefined, 4, -0.5)).toBe(8);
  });

  it('reads a world slop at scale 1 when the scale has no magnitude', () => {
    expect(widenSlop(1, 4, 0)).toBe(5);
    expect(widenSlop(1, 4, NaN)).toBe(5);
  });
});
