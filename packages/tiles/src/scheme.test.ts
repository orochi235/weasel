import { describe, expect, it } from 'vitest';
import { createPlaneScheme, planeFloor } from './scheme';

describe('planeFloor', () => {
  const scheme = createPlaneScheme(256);

  it('holds a line of no width lying on a tile edge', () => {
    for (const bounds of [[0, 0, 0, 800], [1024, 0, 1024, 800], [0, 1024, 800, 1024]]) {
      const keys = planeFloor(scheme, 256, bounds);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('planeFloor tile size', () => {
  it('throws when its tilePx is not the scheme\'s', () => {
    expect(() => planeFloor(createPlaneScheme(256), 512, [0, 0, 4000, 3000])).toThrow(RangeError);
    expect(planeFloor(createPlaneScheme(512), 512, [0, 0, 4000, 3000]).length).toBeGreaterThan(0);
  });
});

describe('planeFloor floorTiles', () => {
  const scheme = createPlaneScheme(256);

  it('throws for fewer than two tiles a side, which no level can promise a box straddling an edge', () => {
    expect(() => planeFloor(scheme, 256, [1900, 1900, 2500, 2500], 1)).toThrow(RangeError);
    expect(() => planeFloor(scheme, 256, [0, 0, 100, 100], Number.NaN)).toThrow(RangeError);
  });

  it('holds a box straddling tile edges in at most floorTiles a side', () => {
    for (const n of [2, 3, 4]) {
      const keys = planeFloor(scheme, 256, [1900, 1900, 2500, 2500], n);
      expect(new Set(keys.map((k) => k.x)).size).toBeLessThanOrEqual(n);
      expect(new Set(keys.map((k) => k.y)).size).toBeLessThanOrEqual(n);
    }
  });
});

describe('planeFloor far from the origin', () => {
  it('holds a line of no width at a large coordinate in at most floorTiles a side', () => {
    const scheme = createPlaneScheme(512);
    for (const bounds of [[1e15, 0, 1e15, 1], [0, -3e14, 1, -3e14]]) {
      const keys = planeFloor(scheme, 512, bounds);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys.map((k) => k.x)).size).toBeLessThanOrEqual(2);
      expect(new Set(keys.map((k) => k.y)).size).toBeLessThanOrEqual(2);
    }
  });
});
