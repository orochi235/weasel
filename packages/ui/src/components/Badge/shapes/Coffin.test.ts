import { describe, it, expect } from 'vitest';
import Coffin from './Coffin';

const vertices = (params: Parameters<NonNullable<typeof Coffin.compose>>[0]) =>
  Coffin.compose!(params).baseParams!.vertices as [number, number][];

describe('coffin', () => {
  it('reads shoulderHalfHeight as a half-height, like the head and the foot', () => {
    const v = vertices({ headHalfHeight: 40, shoulderHalfHeight: 40, footHalfHeight: 40 });
    expect(v.map(([, y]) => y)).toEqual([10, 10, 10, 90, 90, 90]);
  });

  it('draws its defaults with full-height shoulders', () => {
    expect(vertices({})[1][1]).toBe(0);
  });
});
