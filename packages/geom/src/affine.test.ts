import { describe, it, expect } from 'vitest';
import { transformCoords } from './affine';
import { multiply, translate, rotate, scale, applyToPoint } from './mat3';
import { cubicEvalAt } from './curve';
import { approxEq } from './scalar';

describe('transformCoords', () => {
  it('applies the matrix to every coord pair, returns Float64Array', () => {
    const out = transformCoords(Float32Array.of(0, 0, 1, 0), translate(10, 5));
    expect(out).toBeInstanceOf(Float64Array);
    expect(Array.from(out)).toEqual([10, 5, 11, 5]);
  });
  it('preserves curves under affine: transformed control points define the transformed curve', () => {
    const m = multiply(translate(3, -2), multiply(rotate(0.6), scale(2, 1.4)));
    const ctrl = Float32Array.of(0, 0, 1, 3, 4, 3, 5, 0); // one cubic's 4 points
    const moved = transformCoords(ctrl, m);
    // Sample the original curve at t, transform the sample; compare to the
    // same sample of the moved curve. Affine invariance ⇒ they coincide.
    for (const t of [0.25, 0.5, 0.75]) {
      const s = cubicEvalAt(ctrl[0], ctrl[1], ctrl[2], ctrl[3], ctrl[4], ctrl[5], ctrl[6], ctrl[7], t);
      const sMoved = applyToPoint(m, s[0], s[1]);
      const onMoved = cubicEvalAt(moved[0], moved[1], moved[2], moved[3], moved[4], moved[5], moved[6], moved[7], t);
      expect(approxEq(onMoved[0], sMoved[0])).toBe(true);
      expect(approxEq(onMoved[1], sMoved[1])).toBe(true);
    }
  });
});
