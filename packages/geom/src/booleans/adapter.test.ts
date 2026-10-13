import { describe, it, expect } from 'vitest';
import { pathToMultiPolygon, multiPolygonToPath, type MultiPolygon, type Ring } from './adapter';
import { PATH_M, PATH_L, PATH_Z } from '../commands';
import type { RectPath, PolygonPath } from '../path';
import { pointInPath } from '../pathHitTest';

describe('pathToMultiPolygon', () => {
  it('emits a single 4-corner ring for a RectPath', () => {
    const rect: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 20 };
    const mp = pathToMultiPolygon(rect);
    // One polygon, one ring, 4 corners + repeat of first (closed).
    expect(mp).toHaveLength(1);
    expect(mp[0]).toHaveLength(1);
    expect(mp[0][0]).toEqual([
      [0, 0],
      [10, 0],
      [10, 20],
      [0, 20],
      [0, 0],
    ]);
  });

  it('emits a closed ring for an explicit triangle PolygonPath', () => {
    const tri: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 5, 10]),
      fillRule: 'nonzero',
    };
    const mp = pathToMultiPolygon(tri);
    expect(mp).toHaveLength(1);
    expect(mp[0]).toHaveLength(1);
    expect(mp[0][0]).toEqual([
      [0, 0],
      [10, 0],
      [5, 10],
      [0, 0],
    ]);
  });

  it('closes an open (no-Z) contour implicitly', () => {
    const open: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 5, 10]),
      fillRule: 'nonzero',
    };
    const mp = pathToMultiPolygon(open);
    expect(mp[0][0][mp[0][0].length - 1]).toEqual([0, 0]);
  });

  it('collapses a nested same-winding contour under nonzero into one polygon', () => {
    const two: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,
        2, 2, 8, 2, 8, 8, 2, 8,
      ]),
      fillRule: 'nonzero',
    };
    const mp = pathToMultiPolygon(two);
    expect(mp).toHaveLength(1);
    expect(mp[0]).toHaveLength(1);
  });

  it('throws on an unknown command rather than misreading the coord stream', () => {
    const bogus: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, 99, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 5, 10]),
      fillRule: 'nonzero',
    };
    expect(() => pathToMultiPolygon(bogus)).toThrow(/pathToMultiPolygon: unknown command 99/);
  });
});

describe('multiPolygonToPath', () => {
  it('emits one M/L*/Z per ring with nonzero fillRule', () => {
    const mp: MultiPolygon = [
      [[
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ]],
    ];
    const path = multiPolygonToPath(mp);
    expect(path.kind).toBe('polygon');
    expect(path.fillRule).toBe('nonzero');
    expect(Array.from(path.commands)).toEqual([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]);
    expect(Array.from(path.coords)).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });

  it('returns an empty PolygonPath for an empty MultiPolygon', () => {
    const path = multiPolygonToPath([]);
    expect(path.kind).toBe('polygon');
    expect(path.commands.length).toBe(0);
    expect(path.coords.length).toBe(0);
    expect(path.fillRule).toBe('nonzero');
  });

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

describe('round-trip', () => {
  it('rect → MultiPolygon → PolygonPath preserves inside-ness', () => {
    const rect: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const round = multiPolygonToPath(pathToMultiPolygon(rect));
    expect(pointInPath(round, 5, 5)).toBe(true);
    expect(pointInPath(round, 15, 5)).toBe(false);
  });
});

const poly = (rings: number[][], fillRule: 'nonzero' | 'evenodd'): PolygonPath => {
  const commands: number[] = [];
  const coords: number[] = [];
  for (const ring of rings) {
    commands.push(PATH_M);
    coords.push(ring[0], ring[1]);
    for (let i = 2; i < ring.length; i += 2) {
      commands.push(PATH_L);
      coords.push(ring[i], ring[i + 1]);
    }
    commands.push(PATH_Z);
  }
  return {
    kind: 'polygon',
    commands: new Uint8Array(commands),
    coords: new Float32Array(coords),
    fillRule,
  };
};

const signedArea = (r: Ring): number => {
  let a = 0;
  for (let i = 0, n = r.length - 1; i < n; i++) {
    a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  }
  return a / 2;
};

const OUTER = [0, 0, 100, 0, 100, 100, 0, 100];
const INNER_SAME = [25, 25, 75, 25, 75, 75, 25, 75];
const INNER_REVERSED = [25, 25, 25, 75, 75, 75, 75, 25];

describe('pathToMultiPolygon ring grouping', () => {
  it('nests an opposite-wound inner ring as a hole under nonzero', () => {
    const mp = pathToMultiPolygon(poly([OUTER, INNER_REVERSED], 'nonzero'));
    expect(mp).toHaveLength(1);
    expect(mp[0]).toHaveLength(2);
    expect(Math.abs(signedArea(mp[0][0]))).toBeCloseTo(10000);
    expect(Math.abs(signedArea(mp[0][1]))).toBeCloseTo(2500);
  });

  it('nests an inner ring as a hole under evenodd regardless of winding', () => {
    for (const inner of [INNER_SAME, INNER_REVERSED]) {
      const mp = pathToMultiPolygon(poly([OUTER, inner], 'evenodd'));
      expect(mp).toHaveLength(1);
      expect(mp[0]).toHaveLength(2);
    }
  });

  it('emits disjoint rings as separate polygons', () => {
    const mp = pathToMultiPolygon(poly([OUTER, [200, 200, 250, 200, 250, 250, 200, 250]], 'nonzero'));
    expect(mp).toHaveLength(2);
    expect(mp[0]).toHaveLength(1);
    expect(mp[1]).toHaveLength(1);
  });

  it('emits an island inside a hole as its own polygon', () => {
    const island = [40, 40, 60, 40, 60, 60, 40, 60];
    const mp = pathToMultiPolygon(poly([OUTER, INNER_REVERSED, island], 'nonzero'));
    expect(mp).toHaveLength(2);
    expect(mp[0]).toHaveLength(2);
    expect(mp[1]).toHaveLength(1);
  });
});
