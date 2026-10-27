import { describe, it, expect } from 'vitest';
import { glyphCorners } from './glyphCorners';

/** One quad: box (2, -8)–(6, 0) on a baseline at 0, its pen at x = 1. */
const quad = (rotate: number): number[] => [2, -8, 6, 0, 0, 0, 1, 1, 0, 1, rotate];

const corners = (q: number[], ox = 0, oy = 0, tan = 0): number[] => {
  const out: number[] = [];
  glyphCorners(q, 0, ox, oy, tan, out);
  return out.map((v) => Math.round(v * 1e9) / 1e9 + 0);
};

describe('glyphCorners', () => {
  it('gives an upright quad its own box, moved', () => {
    expect(corners(quad(0), 10, 20)).toEqual([12, 12, 16, 12, 16, 20, 12, 20]);
  });

  it('turns the corners clockwise about the pen on the baseline', () => {
    // A quarter turn takes (dx, dy) from the pen to (-dy, dx).
    expect(corners(quad(90), 10, 20)).toEqual([19, 21, 19, 25, 11, 25, 11, 21]);
  });

  it('leans before it turns', () => {
    // A lean of 0.5 moves the top corners 4 right; a half turn then mirrors both axes about the pen.
    expect(corners(quad(180), 0, 0, 0.5)).toEqual([-4, 8, -8, 8, -4, 0, 0, 0]);
  });
});
