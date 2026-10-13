import { describe, expect, it } from 'vitest';
import { earliestRest } from './springRest';

const THRESHOLD = 0.01;

/** When a spring toward 0 is first under the threshold in both position and speed, in ms,
 *  stepped far finer than a frame. */
function restsAt(x: number, v: number, k: number, c: number, m: number): number {
  const dt = 1e-5;
  for (let t = 0; t < 30; t += dt) {
    if (Math.abs(x) < THRESHOLD && Math.abs(v) < THRESHOLD) return t * 1000;
    v += ((-k * x - c * v) / m) * dt;
    x += v * dt;
  }
  throw new Error('the spring never rested');
}

describe('earliestRest', () => {
  it.each([
    ['the default spring', 100, 0, 170, 26, 1],
    ['an underdamped spring', 100, 0, 300, 5, 1],
    ['an overdamped spring', 100, 0, 50, 60, 1],
    ['a heavy spring', -40, 0, 170, 26, 4],
    ['a spring pushed where it stands', 0, 900, 170, 26, 1],
    ['a spring thrown away from its rest', 20, 500, 120, 14, 1],
  ])('is above 0 and no later than %s comes to rest', (_name, x, v, k, c, m) => {
    const bound = earliestRest([x], [v], k, c, m, THRESHOLD);
    const real = restsAt(x, v, k, c, m);
    expect(bound).toBeLessThanOrEqual(real);
    expect(bound).toBeGreaterThan(0);
  });

  it('weighs every axis', () => {
    const one = earliestRest([100, 0], [0, 0], 170, 26, 1, THRESHOLD);
    const two = earliestRest([100, 100], [0, 0], 170, 26, 1, THRESHOLD);
    expect(two).toBeGreaterThan(one);
  });

  it('is when a coast has slowed to the threshold', () => {
    // Speed falls as exp(-t * damping / mass): from 500 to 0.01 at 26 a second.
    expect(earliestRest([7], [500], 0, 26, 1, THRESHOLD)).toBeCloseTo((1000 / 26) * Math.log(500 / THRESHOLD), 6);
  });

  it('is 0 for a spring already at rest', () => {
    expect(earliestRest([0], [0], 170, 26, 1, THRESHOLD)).toBe(0);
    expect(earliestRest([0.001], [0.001], 170, 26, 1, THRESHOLD)).toBe(0);
  });
});
