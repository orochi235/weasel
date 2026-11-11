/** Counterexamples `station.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { polylineFromPoints } from '@weasel-js/core/math';
import { labelCenter, labelSpotAt } from './station';

describe('labelSpotAt, shrunk', () => {
  it('reads a center two stretches are nearest alike on the one whose reading stands it there', () => {
    const route = polylineFromPoints([{ x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }]);
    const size = { width: 20, height: 0 };
    const stood = labelCenter(route, { at: 1, offset: -10 }, size)!;
    expect(stood).toEqual({ x: 10, y: 0 });
    const back = labelCenter(route, labelSpotAt(route, stood, size)!, size)!;
    expect(back.x).toBeCloseTo(10, 9);
    expect(back.y).toBeCloseTo(0, 9);
  });

  it('reads a fraction inside the route at a vertex its first stretch, too short to see, ends at', () => {
    const route = polylineFromPoints([{ x: 30, y: 7.006492321624087e-46 }, { x: 30, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
    const spot = labelSpotAt(route, { x: 30, y: 0 }, { width: 0, height: 0 })!;
    expect(spot.at).toBeGreaterThanOrEqual(0);
  });
});
