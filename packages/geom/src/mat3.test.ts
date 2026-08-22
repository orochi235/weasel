import { describe, it, expect } from 'vitest';
import { identity, translate, scale, rotate, multiply, invert, applyToPoint, boxToBox, rotateAboutPoint } from './mat3';
import { approxEq } from './scalar';

const closePt = (got: [number, number], ex: [number, number]) => {
  expect(approxEq(got[0], ex[0])).toBe(true);
  expect(approxEq(got[1], ex[1])).toBe(true);
};

describe('mat3', () => {
  it('identity maps a point to itself', () => {
    closePt(applyToPoint(identity(), 3, 7), [3, 7]);
  });
  it('translate then apply offsets the point', () => {
    closePt(applyToPoint(translate(10, -5), 1, 1), [11, -4]);
  });
  it('scale multiplies components', () => {
    closePt(applyToPoint(scale(2, 3), 4, 5), [8, 15]);
  });
  it('rotate 90° about origin sends +x to +y', () => {
    closePt(applyToPoint(rotate(Math.PI / 2), 1, 0), [0, 1]);
  });
  it('multiply composes (right-applied first)', () => {
    // translate AFTER scale: scale first, then translate.
    const m = multiply(translate(1, 1), scale(2, 2));
    closePt(applyToPoint(m, 3, 4), [7, 9]);
  });
  it('invert round-trips any point', () => {
    const m = multiply(translate(5, -3), multiply(rotate(0.7), scale(2, 1.5)));
    const inv = invert(m)!;
    const round = applyToPoint(inv, ...applyToPoint(m, 9, -2));
    closePt(round, [9, -2]);
  });
  it('invert returns null for a degenerate (zero-determinant) matrix', () => {
    expect(invert(scale(0, 1))).toBeNull();
  });
  it('boxToBox maps the source rect corners onto the destination rect', () => {
    const m = boxToBox(0, 0, 10, 10, 100, 200, 30, 60);
    closePt(applyToPoint(m, 0, 0), [100, 200]);
    closePt(applyToPoint(m, 10, 10), [130, 260]);
    closePt(applyToPoint(m, 5, 5), [115, 230]);
  });
  it('rotateAboutPoint leaves the pivot fixed', () => {
    closePt(applyToPoint(rotateAboutPoint(4, 4, 1.1), 4, 4), [4, 4]);
  });
});

describe('invert singularity test', () => {
  it('inverts a uniformly small scale', () => {
    const m = invert([1e-7, 0, 0, 1e-7, 0, 0]);
    expect(m).not.toBeNull();
    expect(m![0]).toBeCloseTo(1e7, -1);
  });
  it('rejects a genuinely singular matrix at any magnitude', () => {
    expect(invert([1, 2, 2, 4, 0, 0])).toBeNull();
    expect(invert([1e6, 2e6, 2e6, 4e6, 0, 0])).toBeNull();
    expect(invert([0, 0, 0, 0, 5, 5])).toBeNull();
  });
  it('rejects a non-finite matrix rather than returning NaNs', () => {
    expect(invert([NaN, 0, 0, 1, 0, 0])).toBeNull();
  });
});
