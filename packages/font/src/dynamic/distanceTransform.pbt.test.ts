import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { alphaToSdf } from './distanceTransform';

const RUNS = 300;
const INF = 1e20;

/** The squared distance transform by definition: each texel's least squared distance to a texel plus that texel's cost. */
function bruteEdt(cost: Float64Array, width: number): Float64Array {
  const out = new Float64Array(cost.length);
  for (let i = 0; i < cost.length; i++) {
    const x = i % width, y = Math.floor(i / width);
    let best = Infinity;
    for (let j = 0; j < cost.length; j++) {
      const dx = x - (j % width), dy = y - Math.floor(j / width);
      best = Math.min(best, dx * dx + dy * dy + cost[j]!);
    }
    out[i] = best;
  }
  return out;
}

/** `alphaToSdf` with the transform done by brute force. */
function oracle(alpha: Uint8Array, width: number, height: number, radius: number, cutoff: number): Uint8Array {
  const outer = new Float64Array(alpha.length);
  const inner = new Float64Array(alpha.length);
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i]! / 255;
    outer[i] = a === 1 ? 0 : a === 0 ? INF : Math.max(0, 0.5 - a) ** 2;
    inner[i] = a === 1 ? INF : a === 0 ? 0 : Math.max(0, a - 0.5) ** 2;
  }
  const o = bruteEdt(outer, width), n = bruteEdt(inner, width);
  return Uint8Array.from(o, (_, i) => {
    const byte = Math.round(255 - 255 * ((Math.sqrt(o[i]!) - Math.sqrt(n[i]!)) / radius + cutoff));
    return byte < 0 ? 0 : byte > 255 ? 255 : byte;
  });
}

const bitmap = fc.record({ width: fc.integer({ min: 1, max: 9 }), height: fc.integer({ min: 1, max: 9 }) }).chain(({ width, height }) =>
  fc.record({
    width: fc.constant(width), height: fc.constant(height),
    alpha: fc.uint8Array({ minLength: width * height, maxLength: width * height }).chain((noise) =>
      fc.array(fc.constantFrom('solid', 'empty', 'noise'), { minLength: width * height, maxLength: width * height })
        .map((kinds) => Uint8Array.from(kinds, (k, i) => (k === 'solid' ? 255 : k === 'empty' ? 0 : noise[i]!)))),
  }));

describe('alphaToSdf, property', () => {
  it('matches the distance transform done by brute force, within a byte', () => {
    const t = tally();
    fc.assert(fc.property(bitmap, fc.integer({ min: 1, max: 8 }), fc.constantFrom(0.25, 0.5, 0.75), ({ width, height, alpha }, radius, cutoff) => {
      const got = alphaToSdf(alpha, width, height, radius, cutoff);
      const want = oracle(alpha, width, height, radius, cutoff);
      expect(got.length).toBe(width * height);
      for (let i = 0; i < got.length; i++) {
        expect(Math.abs(got[i]! - want[i]!), `texel ${i}`).toBeLessThanOrEqual(1);
        if (want[i]! > 0 && want[i]! < 255) t.count('graded');
      }
    }), runs(RUNS));
    t.atLeast('graded', 500);
  }, timeoutFor(RUNS, 3));
});
