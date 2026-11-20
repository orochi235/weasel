import { describe, expect, it } from 'vitest';
import { stepLine } from './stepLine';

const AXES = [[1, 0], [0, 1]] as const;

describe('stepLine', () => {
  it('holds the direction to the nearest multiple of the step', () => {
    const line = stepLine([0, 0], [10, 1], AXES, Math.PI / 4);
    expect(line.dirs[0]![0]).toBeCloseTo(1);
    expect(line.dirs[0]![1]).toBeCloseTo(0);
  });

  it.each([0, -0, Number.NaN, Infinity, -Infinity])('throws for a step of %s, which has no multiples', (step) => {
    expect(() => stepLine([0, 0], [10, 1], AXES, step)).toThrow(RangeError);
  });
});
