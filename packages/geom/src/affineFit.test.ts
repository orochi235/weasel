import { describe, expect, it } from 'vitest';
import { multiply, rotate, scale, transformCoords, translate, type Affine } from './affine';
import { fitAffine } from './affineFit';

const expectAffine = (got: Affine | null, want: Affine) => {
  expect(got).not.toBeNull();
  got!.forEach((v, i) => expect(v).toBeCloseTo(want[i], 9));
};

describe('fitAffine', () => {
  it('recovers the map between a point set and its image', () => {
    const m = multiply(translate(40, -7), multiply(rotate(0.9), scale(1.5, 0.6)));
    const from = Float64Array.of(0, 0, 100, 0, 100, 100, 0, 100, 30, 70);
    expectAffine(fitAffine(from, transformCoords(from, m)), m);
  });

  it('recovers a turn and an even scale of points on one line', () => {
    const m = multiply(translate(5, 5), multiply(rotate(-1.1), scale(2, 2)));
    const from = Float64Array.of(0, 0, 10, 10, 30, 30);
    expectAffine(fitAffine(from, transformCoords(from, m)), m);
  });

  it('has no fit for fewer than two distinct points', () => {
    expect(fitAffine(Float64Array.of(3, 3, 3, 3), Float64Array.of(1, 1, 1, 1))).toBeNull();
    // One point repeated away from the origin: its mean rounds, leaving a spread of noise.
    const v = 98765.4321;
    expect(fitAffine(Float64Array.of(v, v, v, v, v, v), Float64Array.of(1, 2, 3, 4, 5, 6))).toBeNull();
  });

  it('fits distinct points however small their coordinates', () => {
    const m = multiply(rotate(0.4), scale(2, 3));
    const from = Float64Array.of(0, 0, 1e-13, 0, 0, 1e-13, 1e-13, 1e-13);
    const got = fitAffine(from, transformCoords(from, m));
    expect(got).not.toBeNull();
    got!.slice(0, 4).forEach((x, i) => expect(x).toBeCloseTo(m[i], 9));
  });
});
