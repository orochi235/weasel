import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { coord } from './pbt.fixture';

describe('coord', () => {
  it('never draws -0', () => {
    expect(fc.sample(coord(), { numRuns: 5000, seed: 1 }).some((v) => Object.is(v, -0))).toBe(false);
  });
});
