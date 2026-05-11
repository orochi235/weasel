import { describe, it, expect } from 'vitest';
import { pathToMultiPolygon, multiPolygonToPath } from './booleans.adapter';
import type { RectPath, PolygonPath } from './types';
import { PATH_M, PATH_L, PATH_Z } from './types';
import { pointInPath } from './hitTest';

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

describe('multiPolygonToPath', () => {
  it('emits one M/L*/Z per ring with nonzero fillRule', () => {
    const mp = [
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

  it('emits multiple rings for a polygon-with-hole', () => {
    const mp = [
      [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]],
      ],
    ];
    const path = multiPolygonToPath(mp);
    // Two M commands, one per ring.
    let mCount = 0;
    for (const c of path.commands) if (c === PATH_M) mCount++;
    expect(mCount).toBe(2);
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
