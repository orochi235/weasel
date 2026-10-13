import { describe, it, expect } from 'vitest';
import { meanScale } from './meanScale';

describe('meanScale', () => {
  it('returns the scale when both axes are equal', () => {
    expect(meanScale({ x: 1, y: 1 })).toBe(1);
    expect(meanScale({ x: 2.5, y: 2.5 })).toBe(2.5);
  });

  it('returns sqrt(x * y) when axes differ', () => {
    expect(meanScale({ x: 1, y: 4 })).toBe(2);
    expect(meanScale({ x: 9, y: 4 })).toBe(6);
  });

  it('reads a flipped axis by its magnitude', () => {
    expect(meanScale({ x: 2, y: -2 })).toBe(2);
    expect(meanScale({ x: -2, y: -2 })).toBe(2);
    expect(meanScale({ x: 1, y: -4 })).toBe(2);
  });
});
