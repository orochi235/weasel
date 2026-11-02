import { describe, expect, it } from 'vitest';
import { DEG_TO_RAD, RAD_TO_DEG, wrapAngle, wrapPositive } from './angle';

const PI = Math.PI;
const TAU = 2 * PI;

describe('DEG_TO_RAD / RAD_TO_DEG', () => {
  it('convert a half turn each way and invert each other', () => {
    expect(180 * DEG_TO_RAD).toBe(PI);
    expect(PI * RAD_TO_DEG).toBe(180);
    expect(DEG_TO_RAD * RAD_TO_DEG).toBeCloseTo(1, 15);
  });
});

describe('wrapAngle', () => {
  it('leaves an angle already inside the half circle alone', () => {
    for (const a of [0, 1, -1, PI / 2, -PI / 2, PI - 1e-12, -PI + 1e-12]) expect(wrapAngle(a)).toBe(a);
  });

  it('wraps whole turns away', () => {
    expect(wrapAngle(TAU)).toBe(0);
    expect(wrapAngle(TAU + 1)).toBeCloseTo(1, 12);
    expect(wrapAngle(-TAU - 1)).toBeCloseTo(-1, 12);
    expect(wrapAngle(3 * PI / 2)).toBeCloseTo(-PI / 2, 12);
    expect(wrapAngle(-3 * PI / 2)).toBeCloseTo(PI / 2, 12);
    expect(wrapAngle(100 * TAU + 0.5)).toBeCloseTo(0.5, 9);
  });

  it("puts a half turn at π by default ('max')", () => {
    for (const a of [PI, -PI, 3 * PI, -3 * PI, 5 * PI]) expect(wrapAngle(a)).toBe(PI);
    expect(wrapAngle(PI, 'max')).toBe(PI);
  });

  it("puts a half turn at -π under 'min'", () => {
    for (const a of [PI, -PI, 3 * PI, -3 * PI, 5 * PI]) expect(wrapAngle(a, 'min')).toBe(-PI);
  });

  it("keeps a half turn's sign under 'sign'", () => {
    for (const a of [PI, 3 * PI, 5 * PI]) expect(wrapAngle(a, 'sign')).toBe(PI);
    for (const a of [-PI, -3 * PI, -5 * PI]) expect(wrapAngle(a, 'sign')).toBe(-PI);
  });

  it('agrees across conventions everywhere but the half turn', () => {
    for (let a = -7; a <= 7; a += 0.37) {
      expect(wrapAngle(a, 'min')).toBe(wrapAngle(a, 'max'));
      expect(wrapAngle(a, 'sign')).toBe(wrapAngle(a, 'max'));
    }
  });

  it('gives NaN for NaN and the infinities', () => {
    for (const half of ['max', 'min', 'sign'] as const) {
      expect(wrapAngle(Number.NaN, half)).toBeNaN();
      expect(wrapAngle(Infinity, half)).toBeNaN();
      expect(wrapAngle(-Infinity, half)).toBeNaN();
    }
  });
});

describe('wrapPositive', () => {
  it('wraps radians to [0, 2π)', () => {
    expect(wrapPositive(0)).toBe(0);
    expect(wrapPositive(-0)).toBe(0);
    expect(wrapPositive(TAU)).toBe(0);
    expect(wrapPositive(-PI)).toBe(PI);
    expect(wrapPositive(-PI / 2)).toBeCloseTo(3 * PI / 2, 12);
    expect(wrapPositive(5 * PI)).toBeCloseTo(PI, 12);
  });

  it('wraps degrees to [0, 360)', () => {
    expect(wrapPositive(0, 360)).toBe(0);
    expect(wrapPositive(360, 360)).toBe(0);
    expect(wrapPositive(720, 360)).toBe(0);
    expect(wrapPositive(-90, 360)).toBe(270);
    expect(wrapPositive(-360, 360)).toBe(0);
    expect(wrapPositive(370, 360)).toBe(10);
    expect(wrapPositive(-725, 360)).toBe(355);
  });

  it('never returns the period for a negative angle a hair below zero', () => {
    expect(wrapPositive(-1e-14, 360)).toBe(0);
    expect(wrapPositive(-1e-17)).toBe(0);
  });

  it('gives NaN for NaN and the infinities', () => {
    expect(wrapPositive(Number.NaN)).toBeNaN();
    expect(wrapPositive(Infinity, 360)).toBeNaN();
    expect(wrapPositive(-Infinity, 360)).toBeNaN();
  });
});
