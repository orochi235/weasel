import { describe, expect, test } from 'vitest';
import { lineShape } from './shape';

describe('lineShape', () => {
  const line = lineShape({ x: 10, y: 20 }, { x: 210, y: 20 });
  test('a line maps a fraction to a point along it, with a unit tangent and its left as normal', () => {
    expect(line.length).toBe(200);
    expect(line.at(0.25)).toEqual({
      point: { x: 60, y: 20 },
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: -1 },
    });
  });
  test('nearest projects onto the segment and measures the distance', () => {
    expect(line.nearest({ x: 110, y: 50 })).toEqual({ f: 0.5, dist: 30 });
  });
  test('nearest past an end answers that end', () => {
    expect(line.nearest({ x: -40, y: 20 })).toEqual({ f: 0, dist: 50 });
  });
  test('a line drawn right to left has its normal pointing down', () => {
    expect(lineShape({ x: 210, y: 20 }, { x: 10, y: 20 }).at(0).normal).toEqual({ x: 0, y: 1 });
  });
  test('a zero-length line answers its one point, heading right, never NaN', () => {
    const dot = lineShape({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(dot.at(0.5)).toEqual({
      point: { x: 5, y: 5 },
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: -1 },
    });
    expect(dot.nearest({ x: 9, y: 8 })).toEqual({ f: 0, dist: 5 });
  });
});
