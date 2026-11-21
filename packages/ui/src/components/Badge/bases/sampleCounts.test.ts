import { describe, expect, it } from 'vitest';
import { BASES } from '.';
import { MAX_SAMPLES } from './polygonSampler';

const vertexCount = (path: string) => (path.match(/[ML] /g) ?? []).length;

describe('a base sample count', () => {
  for (const key of ['octant-spline', 'octant-bspline'] as const) {
    it(`stops at ${MAX_SAMPLES} on ${key}, and reads NaN as its least`, () => {
      const base = BASES[key];
      expect(vertexCount(base.build({ samples: Infinity }, 80, 80).bodyPath)).toBe(MAX_SAMPLES);
      expect(vertexCount(base.build({ samples: 1e8 }, 80, 80).bodyPath)).toBe(MAX_SAMPLES);
      expect(vertexCount(base.build({ samples: NaN }, 80, 80).bodyPath)).toBe(48);
    });
  }

  it('stops at 256 per tab arc on a puzzle, and reads NaN as its least', () => {
    const flat = { top: 'out', right: 'flat', bottom: 'flat', left: 'flat' } as const;
    const arc = (arcSamples: number) => vertexCount(BASES.puzzle.build({ ...flat, arcSamples }, 80, 80).bodyPath);
    expect(arc(Infinity) - arc(18)).toBe(256 - 18);
    expect(arc(NaN) - arc(18)).toBe(6 - 18);
  });
});
