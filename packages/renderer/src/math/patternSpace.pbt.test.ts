import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mat3 } from '@weasel-js/geom';
import { affine, runs, spread, tally } from '../pbt.fixture';
import { patternTileSpace } from './patternSpace';

const tileTransform = fc.oneof(
  fc.constant(undefined),
  fc.tuple(spread(-3, 3), spread(-3, 3), spread(-3, 3), spread(-3, 3)),
  // Singular: a tile collapsed to a line.
  fc.tuple(spread(-3, 3), spread(-3, 3), spread(-2, 2)).map(([a, b, k]) => [a, b, a * k, b * k] as [number, number, number, number]),
);

describe('patternTileSpace, property', () => {
  it('takes a screen point to the tile point that origin + transform places there, or is null for a singular tile', () => {
    const t = tally();
    fc.assert(fc.property(affine, fc.record({ x: spread(-500, 500), y: spread(-500, 500) }), tileTransform, spread(-500, 500), spread(-500, 500),
      (space, origin, tr, sx, sy) => {
        const got = patternTileSpace(space, origin, tr);
        const T = tr ?? [1, 0, 0, 1];
        const det = T[0] * T[3] - T[1] * T[2];
        if (got === null) {
          t.count('null');
          expect(Math.abs(det)).toBeLessThan(1e-9);
          return;
        }
        if (Math.abs(det) < 1e-3) return;
        t.count('mapped');
        const [px, py] = mat3.apply(space, sx, sy);
        const [tx, ty] = mat3.apply(got, sx, sy);
        const bx = origin.x + T[0] * tx + T[2] * ty, by = origin.y + T[1] * tx + T[3] * ty;
        const tol = 1e-8 * (1 + Math.abs(px) + Math.abs(py) + Math.abs(origin.x) + Math.abs(origin.y)) / Math.min(1, Math.abs(det));
        expect(Math.abs(bx - px)).toBeLessThanOrEqual(tol);
        expect(Math.abs(by - py)).toBeLessThanOrEqual(tol);
      }), runs(300));
    t.atLeast('null', 20);
    t.atLeast('mapped', 100);
  });
});
