import { describe, expect, it } from 'vitest';
import { medianError } from './frameTiming';

describe('medianError', () => {
  it('shrinks as samples of the same spread accumulate', () => {
    const noisy = (n: number): number[] => Array.from({ length: n }, (_, i) => (i % 5) - 2);
    expect(medianError(noisy(100))).toBeLessThan(medianError(noisy(20)) / 2);
  });

  it('is not set by one stalled frame', () => {
    const steady = [1, 1.1, 0.9, 1, 1.05, 0.95, 1, 1.1, 0.9];
    expect(medianError([...steady, 4000])).toBeLessThan(0.1);
  });

  it('is zero for samples that agree', () => {
    expect(medianError([2, 2, 2, 2])).toBe(0);
  });
});
