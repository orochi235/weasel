import { describe, expect, it } from 'vitest';
import { lineSegment, type CubicSegment } from './cubicContours';
import { outsideSide } from './contourSides';

const square = (s: number): CubicSegment[] =>
  [lineSegment(0, 0, s, 0), lineSegment(s, 0, s, s), lineSegment(s, s, 0, s), lineSegment(0, s, 0, 0)];

describe('outsideSide', () => {
  it('finds the side of a hole drawn as one closed curve', () => {
    const loop: CubicSegment = { c: [50, 30, 90, 90, 10, 90, 50, 30], line: false };
    const back: CubicSegment = { c: [50, 30, 10, 90, 90, 90, 50, 30], line: false };
    const sides = [loop, back].map((seg) => outsideSide([square(100), [seg]], 1));
    expect(sides.filter((s) => s !== null)).toHaveLength(1);
  });
});
