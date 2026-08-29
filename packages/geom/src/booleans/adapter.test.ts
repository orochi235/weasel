import { describe, it, expect } from 'vitest';
import { pathToMultiPolygon, multiPolygonToPath, type GeomPath, type Ring } from './adapter';
import { PATH_M, PATH_L, PATH_Z } from '../commands';

/** Outer square 0..100 with a 40..60 square ring inside it. */
const donut = (fillRule: 'nonzero' | 'evenodd', reverseInner: boolean): GeomPath => ({
  kind: 'polygon',
  commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z, PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z),
  coords: Float64Array.of(
    0, 0, 100, 0, 100, 100, 0, 100,
    ...(reverseInner
      ? [40, 40, 40, 60, 60, 60, 60, 40]
      : [40, 40, 60, 40, 60, 60, 40, 60]),
  ),
  fillRule,
});

const signedArea = (r: Ring): number => {
  let a = 0;
  for (let i = 0, n = r.length - 1; i < n; i++) {
    a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  }
  return a / 2;
};

describe('pathToMultiPolygon ring nesting', () => {
  it('nests an opposite-wound inner ring as a hole under nonzero', () => {
    const mp = pathToMultiPolygon(donut('nonzero', true));
    expect(mp).toHaveLength(1);
    expect(mp[0]).toHaveLength(2);
    expect(Math.abs(signedArea(mp[0][0]))).toBeCloseTo(10000);
    expect(Math.abs(signedArea(mp[0][1]))).toBeCloseTo(400);
  });

  it('keeps a same-wound inner ring solid under nonzero', () => {
    // Both rings wind the same way: winding number inside the inner ring is 2,
    // so nonzero fills it — no hole.
    const mp = pathToMultiPolygon(donut('nonzero', false));
    expect(mp.every((poly) => poly.length === 1)).toBe(true);
  });

  it('nests an inner ring as a hole under evenodd regardless of winding', () => {
    for (const reverse of [true, false]) {
      const mp = pathToMultiPolygon(donut('evenodd', reverse));
      expect(mp).toHaveLength(1);
      expect(mp[0]).toHaveLength(2);
    }
  });

  it('defaults to nonzero when fillRule is omitted', () => {
    const p = donut('nonzero', true);
    const noRule: GeomPath = { kind: 'polygon', commands: (p as { commands: ArrayLike<number> }).commands, coords: (p as { coords: ArrayLike<number> }).coords };
    expect(pathToMultiPolygon(noRule)).toEqual(pathToMultiPolygon(p));
  });

  it('leaves two disjoint rings as two polygons', () => {
    const two: GeomPath = {
      kind: 'polygon',
      commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_Z, PATH_M, PATH_L, PATH_L, PATH_Z),
      coords: Float64Array.of(0, 0, 10, 0, 0, 10, 100, 100, 110, 100, 100, 110),
    };
    const mp = pathToMultiPolygon(two);
    expect(mp).toHaveLength(2);
    expect(mp.every((poly) => poly.length === 1)).toBe(true);
  });
});

describe('multiPolygonToPath', () => {
  it('emits one M…L…Z run per ring, holes included', () => {
    const p = multiPolygonToPath([[
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[2, 2], [2, 4], [4, 4], [4, 2], [2, 2]],
    ]]);
    expect(Array.from(p.commands)).toEqual([
      PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
    ]);
    expect(p.coords).toHaveLength(16);
  });

  it('skips rings with fewer than three unique vertices', () => {
    const p = multiPolygonToPath([[[[0, 0], [1, 1], [0, 0]]]]);
    expect(p.commands).toHaveLength(0);
  });
});

describe('pathToMultiPolygon unknown commands', () => {
  it('throws rather than misreading the coord stream', () => {
    const bogus: GeomPath = {
      kind: 'polygon',
      commands: Uint8Array.of(PATH_M, 99, PATH_L, PATH_Z),
      coords: Float64Array.of(0, 0, 10, 0, 5, 10),
      fillRule: 'nonzero',
    };
    expect(() => pathToMultiPolygon(bogus)).toThrow(/pathToMultiPolygon: unknown command 99/);
  });
});
