/**
 * Tests for `isPathLike` + `AUTO_POSE_DESCRIPTOR`. The dispatcher delegates
 * to `pathPoseDescriptor` for `Path` poses and `RECT_POSE_DESCRIPTOR` for
 * everything else; verify both branches fire and the type guard rejects
 * malformed input.
 */
import { describe, it, expect } from 'vitest';
import { isPathLike, AUTO_POSE_DESCRIPTOR } from './autoPoseDescriptor';
import {
  PATH_M,
  PATH_L,
  PATH_Z,
  type PolygonPath,
} from 'features/paths/types';

const polyTriangle: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([0, 0, 10, 0, 5, 10]),
  fillRule: 'nonzero',
};

describe('isPathLike', () => {
  it('matches polygon poses', () => {
    expect(isPathLike(polyTriangle)).toBe(true);
  });

  it('matches rect-kind poses (the Path RectPath variant)', () => {
    expect(isPathLike({ kind: 'rect', x: 0, y: 0, width: 1, height: 1 })).toBe(true);
  });

  it('rejects plain rect poses without a `kind` field', () => {
    expect(isPathLike({ x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });

  it('rejects null and primitives', () => {
    expect(isPathLike(null)).toBe(false);
    expect(isPathLike(undefined)).toBe(false);
    expect(isPathLike(42)).toBe(false);
    expect(isPathLike('rect')).toBe(false);
  });

  it('rejects objects with unknown kind', () => {
    expect(isPathLike({ kind: 'circle', x: 0, y: 0 })).toBe(false);
  });
});

describe('AUTO_POSE_DESCRIPTOR', () => {
  it('dispatches getBounds to path descriptor for path poses', () => {
    expect(AUTO_POSE_DESCRIPTOR.getBounds(polyTriangle)).toMatchObject({
      x: 0, y: 0, width: 10, height: 10,
    });
  });

  it('dispatches getBounds to rect descriptor for plain rect poses', () => {
    expect(AUTO_POSE_DESCRIPTOR.getBounds(
      { x: 4, y: 5, width: 10, height: 20 } as never,
    )).toEqual({ x: 4, y: 5, width: 10, height: 20 });
  });

  it('translate path pose returns a new path with shifted coords', () => {
    const next = AUTO_POSE_DESCRIPTOR.translate!(polyTriangle, 100, 200) as PolygonPath;
    expect(Array.from(next.coords)).toEqual([100, 200, 110, 200, 105, 210]);
    expect(next.kind).toBe('polygon');
  });

  it('translate plain rect pose updates x/y, leaves w/h', () => {
    const next = AUTO_POSE_DESCRIPTOR.translate!(
      { x: 4, y: 5, width: 10, height: 20 } as never,
      1, 2,
    ) as { x: number; y: number; width: number; height: number };
    expect(next).toEqual({ x: 5, y: 7, width: 10, height: 20 });
  });

  it('remapBounds path: source AABB → target AABB rescales path coords', () => {
    const remapped = AUTO_POSE_DESCRIPTOR.remapBounds(
      polyTriangle,
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 0, width: 20, height: 10 },
    ) as PolygonPath;
    // x doubled, y unchanged.
    expect(Array.from(remapped.coords)).toEqual([0, 0, 20, 0, 10, 10]);
  });

  it('intersectsRect path: hit-tests a path against a rect', () => {
    expect(AUTO_POSE_DESCRIPTOR.intersectsRect!(
      polyTriangle,
      { x: 4, y: 4, width: 2, height: 2 },
    )).toBe(true);
    expect(AUTO_POSE_DESCRIPTOR.intersectsRect!(
      polyTriangle,
      { x: 50, y: 50, width: 1, height: 1 },
    )).toBe(false);
  });

  it('intersectsRect plain rect: overlap check', () => {
    expect(AUTO_POSE_DESCRIPTOR.intersectsRect!(
      { x: 0, y: 0, width: 10, height: 10 } as never,
      { x: 5, y: 5, width: 10, height: 10 },
    )).toBe(true);
  });
});
