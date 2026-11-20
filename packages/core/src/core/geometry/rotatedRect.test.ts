import { describe, expect, it } from 'vitest';
import { rotatedRectContainsPoint, rotatedRectCorners } from './rotatedRect';
import { targetCorners, targetTransformOf } from './targetFrame';

describe('rotatedRect helpers on a pose with a transform', () => {
  const skewed = { x: 0, y: 0, width: 10, height: 10, rotation: 0, transform: [1, 0.5, 0, 1] as const };

  it('reports the corners the pose is drawn at', () => {
    expect(rotatedRectCorners(skewed)).toEqual(targetCorners(skewed, targetTransformOf(skewed)));
  });

  it('hits the drawn parallelogram, not the bare box', () => {
    // x' = x, y' = y + 0.5 (x - 5): the right edge runs from y = 2.5 to 12.5.
    expect(rotatedRectContainsPoint(skewed, 9, 12)).toBe(true);
    expect(rotatedRectContainsPoint(skewed, 9, 1)).toBe(false);
  });
});

describe('rotatedRectContainsPoint on a flipped box', () => {
  it('hits a point inside a box with negative extents', () => {
    const flipped = { x: 10, y: 10, width: -10, height: -10, rotation: 0.3 };
    expect(rotatedRectContainsPoint(flipped, 5, 5)).toBe(true);
    expect(rotatedRectContainsPoint(flipped, 15, 15)).toBe(false);
  });
});
