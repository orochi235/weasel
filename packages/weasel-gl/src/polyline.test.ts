import { describe, it, expect } from 'vitest';
import {
  PATH_M, PATH_L, PATH_Q, PATH_Z,
  type PolygonPath,
  type RectPath,
} from '@orochi235/weasel';
import { extractPolylines } from './polyline';

describe('extractPolylines', () => {
  it('emits a closed 4-point polyline for a RectPath', () => {
    const r: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const out = extractPolylines(r);
    expect(out).toHaveLength(1);
    expect(out[0].closed).toBe(true);
    expect(out[0].points).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });

  it('emits a closed polyline for a M/L/L/L/Z polygon', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out).toHaveLength(1);
    expect(out[0].closed).toBe(true);
    expect(out[0].points).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });

  it('emits an open polyline for a polygon without Z', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 20, 0]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out[0].closed).toBe(false);
  });

  it('flattens curves into polyline points', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_Q, PATH_Z]),
      coords: new Float32Array([0, 0, 5, 10, 10, 0]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out[0].points.length).toBeGreaterThan(4);
    expect(out[0].closed).toBe(true);
  });

  it('emits one polyline per contour for multi-contour paths', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,
        3, 3, 7, 3, 7, 7, 3, 7,
      ]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out).toHaveLength(2);
    expect(out[0].points.length).toBe(8);
    expect(out[1].points.length).toBe(8);
  });
});
