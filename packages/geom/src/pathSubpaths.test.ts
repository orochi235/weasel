import { describe, it, expect } from 'vitest';
import { flatSubpaths } from './pathSubpaths';
import { pathFromD } from './paths/pathFromD';

describe('flatSubpaths', () => {
  it('flattens a path once per tolerance', () => {
    const path = pathFromD('M0 0 C10 -10 20 10 30 0 Z');
    expect(flatSubpaths(path, 0.5)).toBe(flatSubpaths(path, 0.5));
    const fine = flatSubpaths(path, 0.01);
    expect(fine).not.toBe(flatSubpaths(path, 0.5));
    expect(fine.closed[0].length).toBeGreaterThan(flatSubpaths(path, 0.5).closed[0].length);
  });
});
