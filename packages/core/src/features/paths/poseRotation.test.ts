import { describe, it, expect } from 'vitest';
import { poseRotationOf, rotatePathAround } from './poseRotation';
import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from './types';

describe('poseRotationOf', () => {
  it('returns pivot + angle for a pose with nonzero rotation and AABB', () => {
    const r = poseRotationOf({ x: 10, y: 20, width: 40, height: 60, rotation: Math.PI / 2 });
    expect(r).toEqual({ cx: 30, cy: 50, rotation: Math.PI / 2 });
  });

  it('returns null when rotation is zero', () => {
    expect(poseRotationOf({ x: 0, y: 0, width: 10, height: 10, rotation: 0 })).toBeNull();
  });

  it('returns null when rotation is missing', () => {
    expect(poseRotationOf({ x: 0, y: 0, width: 10, height: 10 })).toBeNull();
  });

  it('returns null when AABB fields are missing (e.g. a bare polygon pose)', () => {
    expect(poseRotationOf({ kind: 'polygon', rotation: Math.PI / 4 })).toBeNull();
  });
});

describe('rotatePathAround', () => {
  it('rotates a polygon point about the pivot', () => {
    // A single segment from (1,0) to (2,0); rotate 90° about origin (0,0).
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_Z]),
      coords: new Float32Array([1, 0, 2, 0]),
      fillRule: 'nonzero',
    };
    const out = rotatePathAround(p, 0, 0, Math.PI / 2) as PolygonPath;
    expect(out.kind).toBe('polygon');
    expect(out.coords[0]).toBeCloseTo(0);
    expect(out.coords[1]).toBeCloseTo(1);
    expect(out.coords[2]).toBeCloseTo(0);
    expect(out.coords[3]).toBeCloseTo(2);
  });

  it('promotes a rotated rect to a four-corner polygon', () => {
    const out = rotatePathAround(
      { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      5, 5, Math.PI / 2,
    ) as PolygonPath;
    expect(out.kind).toBe('polygon');
    // A square rotated 90° about its center maps onto itself; first corner
    // (0,0) lands at (10,0).
    expect(out.coords[0]).toBeCloseTo(10);
    expect(out.coords[1]).toBeCloseTo(0);
  });
});
