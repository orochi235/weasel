import { describe, expect, it } from 'vitest';
import { seedRings } from './hueSearch';

describe('seedRings', () => {
  it('wraps a hue that rounds up to 360 to 0', () => {
    // An anchor at 46 with a 46.29° floor puts a seed at 359.71.
    const hues = seedRings(6, [46], 46.29).flat();
    expect(Math.max(...hues)).toBeLessThan(360);
    expect(hues.every((h) => h >= 0)).toBe(true);
  });
});
