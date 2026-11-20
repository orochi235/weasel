import { describe, it, expect } from 'vitest';
import { PathBuilder } from '../paths/builder';
import { contoursIntersect, parseContours } from './contours';

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
