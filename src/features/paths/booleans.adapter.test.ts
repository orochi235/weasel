import { describe, it, expect } from 'vitest';
import { pathToMultiPolygon } from './booleans.adapter';
import type { RectPath, PolygonPath } from './types';
import { PATH_M, PATH_L, PATH_Z } from './types';

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

  it('produces two polygons for a two-contour PolygonPath', () => {
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
    expect(mp).toHaveLength(2);
  });
});
