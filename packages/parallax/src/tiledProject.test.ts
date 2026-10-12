import { describe, it, expect } from 'vitest';
import { tiledProject } from './tiledProject';

describe('tiledProject', () => {
  it('returns the copies whose cell overlaps the visible range', () => {
    expect(tiledProject(0, 100, 100)).toEqual({ from: 0, to: 1 });
    expect(tiledProject(250, 460, 100)).toEqual({ from: 2, to: 4 });
  });

  it('walks negative copies, so panning either way keeps producing them', () => {
    expect(tiledProject(-350, -120, 100)).toEqual({ from: -4, to: -2 });
  });

  it('widens the range by the bleed on both sides', () => {
    expect(tiledProject(0, 100, 100, 1)).toEqual({ from: -1, to: 1 });
    expect(tiledProject(0, 100, 100, 0)).toEqual({ from: 0, to: 1 });
  });

  it('collapses to a single copy on a non-positive or non-finite period', () => {
    expect(tiledProject(0, 500, 0)).toEqual({ from: 0, to: 0 });
    expect(tiledProject(0, 500, -10)).toEqual({ from: 0, to: 0 });
    expect(tiledProject(0, 500, Infinity)).toEqual({ from: 0, to: 0 });
  });
});
