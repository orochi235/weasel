import { describe, expect, it } from 'vitest';
import { resolveScreenLength } from './paint';

describe('resolveScreenLength', () => {
  it('passes a plain number through as world units', () => {
    expect(resolveScreenLength(12, 4)).toBe(12);
  });

  it('divides a `{ px }` length by the scale', () => {
    expect(resolveScreenLength({ px: 12 }, 4)).toBe(3);
  });

  it('holds its screen size across scales', () => {
    expect(resolveScreenLength({ px: 16 }, 2) * 2)
      .toBeCloseTo(resolveScreenLength({ px: 16 }, 10) * 10);
  });

  it('passes the pixel count through when there is no world to divide into', () => {
    expect(resolveScreenLength({ px: 9 }, 0)).toBe(9);
    expect(resolveScreenLength({ px: 9 }, NaN)).toBe(9);
  });
});
