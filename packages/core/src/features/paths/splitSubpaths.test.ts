import { describe, expect, it } from 'vitest';
import { splitSubpaths } from './splitSubpaths';
import { PATH_M, PATH_L, PATH_C, PATH_Z, type PolygonPath } from './types';

describe('splitSubpaths', () => {
  it('returns a single-element array for a single-region path', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10]),
      fillRule: 'nonzero',
    };
    const out = splitSubpaths(path);
    expect(out).toHaveLength(1);
    expect(Array.from(out[0].commands)).toEqual([PATH_M, PATH_L, PATH_L, PATH_Z]);
    expect(Array.from(out[0].coords)).toEqual([0, 0, 10, 0, 10, 10]);
    expect(out[0].fillRule).toBe('nonzero');
  });

  it('splits a two-region compound path at the M boundary', () => {
    // Two squares: (0,0)→(10,0)→(10,10)→(0,10) and (20,0)→(30,0)→(30,10)→(20,10).
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,
        20, 0, 30, 0, 30, 10, 20, 10,
      ]),
      fillRule: 'evenodd',
    };
    const out = splitSubpaths(path);
    expect(out).toHaveLength(2);
    expect(Array.from(out[0].coords)).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
    expect(Array.from(out[1].coords)).toEqual([20, 0, 30, 0, 30, 10, 20, 10]);
    expect(out[0].fillRule).toBe('evenodd');
    expect(out[1].fillRule).toBe('evenodd');
  });

  it('preserves cubic-bezier commands inside each subpath', () => {
    // Two subpaths, one with a cubic, one straight.
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_C, PATH_Z,
        PATH_M, PATH_L, PATH_Z,
      ]),
      coords: new Float32Array([
        0, 0, /* c1 */ 5, 0, /* c2 */ 10, 5, /* end */ 10, 10,
        50, 50, 60, 60,
      ]),
      fillRule: 'nonzero',
    };
    const out = splitSubpaths(path);
    expect(out).toHaveLength(2);
    expect(Array.from(out[0].commands)).toEqual([PATH_M, PATH_C, PATH_Z]);
    expect(Array.from(out[0].coords)).toEqual([0, 0, 5, 0, 10, 5, 10, 10]);
    expect(Array.from(out[1].commands)).toEqual([PATH_M, PATH_L, PATH_Z]);
    expect(Array.from(out[1].coords)).toEqual([50, 50, 60, 60]);
  });

  it('splits a three-region path correctly', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L,
        PATH_M, PATH_L,
        PATH_M, PATH_L,
      ]),
      coords: new Float32Array([
        0, 0, 1, 1,
        10, 10, 11, 11,
        20, 20, 21, 21,
      ]),
      fillRule: 'nonzero',
    };
    const out = splitSubpaths(path);
    expect(out).toHaveLength(3);
    expect(Array.from(out[0].coords)).toEqual([0, 0, 1, 1]);
    expect(Array.from(out[1].coords)).toEqual([10, 10, 11, 11]);
    expect(Array.from(out[2].coords)).toEqual([20, 20, 21, 21]);
  });
});
