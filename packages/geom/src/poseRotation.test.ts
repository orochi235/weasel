import { describe, it, expect } from 'vitest';
import { poseRotationOf, rotatePathAbout } from './poseRotation';
import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from '@weasel-js/geom';

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

describe('rotatePathAbout', () => {
  it('rotates a polygon point about the pivot', () => {
    // A single segment from (1,0) to (2,0); rotate 90° about origin (0,0).
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_Z]),
      coords: new Float32Array([1, 0, 2, 0]),
      fillRule: 'nonzero',
    };
    const out = rotatePathAbout(p, 0, 0, Math.PI / 2) as PolygonPath;
    expect(out.kind).toBe('polygon');
    expect(out.coords[0]).toBeCloseTo(0);
    expect(out.coords[1]).toBeCloseTo(1);
    expect(out.coords[2]).toBeCloseTo(0);
    expect(out.coords[3]).toBeCloseTo(2);
  });

  it('promotes a rotated rect to a four-corner polygon', () => {
    const out = rotatePathAbout(
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

describe('rotatePathAbout far from 0', () => {
  const at = (p: PolygonPath, i: number) => [p.coords[2 * i] + (p.origin?.x ?? 0), p.coords[2 * i + 1] + (p.origin?.y ?? 0)];
  const rotate = (x: number, y: number, cx: number, cy: number, r: number) => [
    cx + (x - cx) * Math.cos(r) - (y - cy) * Math.sin(r),
    cy + (x - cx) * Math.sin(r) + (y - cy) * Math.cos(r),
  ];

  it("keeps a far rect's rotated corners to their doubles", () => {
    const out = rotatePathAbout({ kind: 'rect', x: 300000.3, y: 300000.3, width: 10, height: 10 }, 300005.3, 300005.3, 0.3);
    const [ex, ey] = rotate(300000.3, 300000.3, 300005.3, 300005.3, 0.3);
    const [x, y] = at(out, 0);
    expect(Math.abs(x - ex)).toBeLessThan(1e-4);
    expect(Math.abs(y - ey)).toBeLessThan(1e-4);
  });

  it('keeps a polygon rotated out to far from 0 to its doubles', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_Z]),
      coords: new Float32Array([1.25, 0, 2.5, 0]),
      fillRule: 'nonzero',
    };
    const out = rotatePathAbout(p, 300000, 0, 0.3);
    const [ex, ey] = rotate(1.25, 0, 300000, 0, 0.3);
    const [x, y] = at(out, 0);
    expect(Math.abs(x - ex)).toBeLessThan(1e-4);
    expect(Math.abs(y - ey)).toBeLessThan(1e-4);
  });
});

describe('poseRotationOf on no pose', () => {
  it('answers null for null and undefined', () => {
    expect(poseRotationOf(null)).toBeNull();
    expect(poseRotationOf(undefined)).toBeNull();
  });
});
