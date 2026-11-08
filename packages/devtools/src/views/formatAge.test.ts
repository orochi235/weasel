import { describe, expect, it } from 'vitest';
import { formatAge } from './formatAge';

describe('formatAge', () => {
  it('reads in the shortest unit that holds the age', () => {
    expect(formatAge(840)).toBe('840ms');
    expect(formatAge(12_340)).toBe('12.3s');
    expect(formatAge(247_000)).toBe('4m07s');
  });

  it('moves up a unit where rounding reaches the next one', () => {
    expect(formatAge(999.6)).toBe('1.0s');
    expect(formatAge(59_960)).toBe('1m00s');
  });
});
