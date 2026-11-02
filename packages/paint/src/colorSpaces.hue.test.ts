import { describe, expect, it } from 'vitest';
import { lerpOklch } from './colorSpaces';

const PI = Math.PI;
const TWO_PI = 2 * PI;

/** The hue step `lerpOklch` used before it was closed-form: the reference for finite inputs. */
function loopArc(dh: number): number {
  while (dh > PI) dh -= TWO_PI;
  while (dh < -PI) dh += TWO_PI;
  return dh;
}

/** The hue `lerpOklch` lands on at `t` from hue `h1` to `h2`, both endpoints chromatic. */
const hueAt = (h1: number, h2: number, t: number): number => lerpOklch([0.5, 0.1, h1], [0.5, 0.1, h2], t)[2];

describe('lerpOklch hue', () => {
  it('matches the old loop across every pair of hues atan2 can produce', () => {
    const hues: number[] = [PI, -PI, 0, -0];
    for (let i = 0; i <= 400; i++) hues.push(-PI + (i * TWO_PI) / 400 + 1e-13 * Math.sin(i));
    for (const h1 of hues) {
      for (const h2 of [h1 + PI, h1 - PI, ...hues.slice(0, 60)]) {
        expect(Object.is(hueAt(h1, h2, 1), h1 + loopArc(h2 - h1))).toBe(true);
      }
    }
  });

  it('keeps the sign of a half turn, as the loop did', () => {
    expect(hueAt(0, PI, 0.5)).toBe(PI / 2);
    expect(hueAt(0, -PI, 0.5)).toBe(-PI / 2);
    expect(hueAt(-PI, 2 * PI, 1)).toBe(-PI + loopArc(3 * PI));
    expect(hueAt(PI, -2 * PI, 1)).toBe(PI + loopArc(-3 * PI));
  });

  it('wraps a delta past a whole turn the shorter way', () => {
    expect(hueAt(0, 5 * PI / 2, 1)).toBeCloseTo(PI / 2, 12);
    expect(hueAt(0, -5 * PI / 2, 1)).toBeCloseTo(-PI / 2, 12);
  });

  it('returns NaN promptly for an infinite or NaN hue instead of hanging', () => {
    const start = performance.now();
    expect(hueAt(0, Infinity, 0.5)).toBeNaN();
    expect(hueAt(0, -Infinity, 0.5)).toBeNaN();
    expect(hueAt(Infinity, 0, 0.5)).toBeNaN();
    expect(hueAt(0, Number.NaN, 0.5)).toBeNaN();
    expect(performance.now() - start).toBeLessThan(100);
  }, 1000);
});
