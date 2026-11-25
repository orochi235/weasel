import { describe, it, expect } from 'vitest';
import { PathBuilder } from '../paths/builder';
import { contoursIntersect, orientBoundaries, parseContours } from './contours';

const squares = (...boxes: [number, number, number][]) => {
  const b = new PathBuilder();
  for (const [x, y, s] of boxes) b.moveTo(x, y).lineTo(x + s, y).lineTo(x + s, y + s).lineTo(x, y + s).close();
  return b.build();
};

describe('contoursIntersect', () => {
  it('finds no crossing in two apart squares or a square with a hole', () => {
    expect(contoursIntersect(parseContours(squares([0, 0, 10], [20, 0, 10])), 0.5)).toBe(false);
    expect(contoursIntersect(parseContours(squares([0, 0, 10], [3, 3, 4])), 0.5)).toBe(false);
  });

  it('finds two squares that overlap', () => {
    expect(contoursIntersect(parseContours(squares([0, 0, 10], [5, 5, 10])), 0.5)).toBe(true);
  });
});

describe('orientBoundaries', () => {
  it('keeps a contour whose longest segment is a cubic with a cusp at its middle', () => {
    const drop = new PathBuilder().moveTo(0, 0).curveTo(1, 1, 0, 1, 1, 0).close().build();
    expect(orientBoundaries(parseContours(drop), 'nonzero')).toHaveLength(1);
  });

  it('keeps a small contour far from the origin', () => {
    const x = 1e11;
    const at = (px: number, py: number) => ({ x: px, y: py });
    const square = [
      [at(x, 0), at(x, 1)], [at(x, 1), at(x - 1, 1)], [at(x - 1, 1), at(x - 1, 0)], [at(x - 1, 0), at(x, 0)],
    ];
    expect(orientBoundaries([square], 'nonzero')).toHaveLength(1);
  });
});
