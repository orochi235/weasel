import { describe, it, expect } from 'vitest';
import { pathDistanceToPoint } from './pathDistance';
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, type PolygonPath, type RectPath } from './types';

const square: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
  fillRule: 'nonzero',
};

describe('pathDistanceToPoint', () => {
  it('measures to the nearest edge from outside', () => {
    expect(pathDistanceToPoint(square, 130, 50)).toBeCloseTo(30, 5);
  });

  it('measures to the nearest edge from inside — the boundary, not the fill', () => {
    expect(pathDistanceToPoint(square, 50, 40)).toBeCloseTo(40, 5);
  });

  it('is zero on the boundary and clamps at a segment endpoint', () => {
    expect(pathDistanceToPoint(square, 50, 0)).toBeCloseTo(0, 5);
    expect(pathDistanceToPoint(square, 130, 140)).toBeCloseTo(50, 5);
  });

  it('measures to the closing edge a Z implies', () => {
    const open: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 100, 0, 100, 100]),
      fillRule: 'nonzero',
    };
    // Nearest point is on the (100,100)→(0,0) diagonal the Z closes.
    expect(pathDistanceToPoint(open, 40, 60)).toBeCloseTo(Math.SQRT2 * 10, 4);
  });

  it('measures to a cubic segment', () => {
    const curve: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_C]),
      coords: new Float32Array([0, 0, 0, 0, 100, 0, 100, 0]),
      fillRule: 'nonzero',
    };
    expect(pathDistanceToPoint(curve, 50, 25)).toBeCloseTo(25, 1);
  });

  it('measures to a quadratic segment', () => {
    const curve: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_Q]),
      coords: new Float32Array([0, 0, 50, 0, 100, 0]),
      fillRule: 'nonzero',
    };
    expect(pathDistanceToPoint(curve, 50, 25)).toBeCloseTo(25, 1);
  });

  it('measures to a rect perimeter', () => {
    const rect: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
    expect(pathDistanceToPoint(rect, 130, 50)).toBeCloseTo(30, 5);
    expect(pathDistanceToPoint(rect, 50, 40)).toBeCloseTo(40, 5);
  });

  it('returns Infinity for an empty path', () => {
    const empty: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([]),
      coords: new Float32Array([]),
      fillRule: 'nonzero',
    };
    expect(pathDistanceToPoint(empty, 0, 0)).toBe(Infinity);
  });
});

describe('pathDistanceToPoint — unknown command', () => {
  it('throws rather than silently misaligning the coordinate cursor', () => {
    const bogus: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, 99, PATH_L]),
      coords: new Float32Array([0, 0, 5, 5, 10, 10]),
      fillRule: 'nonzero',
    };
    expect(() => pathDistanceToPoint(bogus, 0, 0)).toThrow(/unknown command code 99/);
  });
});
