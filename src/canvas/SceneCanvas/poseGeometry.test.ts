/**
 * Tests for the `<SceneCanvas>`-internal pose-shape dispatcher. Three
 * helpers — `isPathLike`, `aabbOfPose`, `poseContains` — route between
 * path-pose math and rect-pose math depending on the pose's `kind` tag.
 */
import { describe, it, expect } from 'vitest';
import { isPathLike, aabbOfPose, poseContains } from './poseGeometry';
import {
  PATH_M,
  PATH_L,
  PATH_Z,
  type PolygonPath,
} from 'features/paths/types';

const tri: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([0, 0, 10, 0, 5, 10]),
  fillRule: 'nonzero',
};

describe('isPathLike', () => {
  it('accepts polygon poses', () => {
    expect(isPathLike(tri)).toBe(true);
  });

  it('accepts rect-kind poses', () => {
    expect(isPathLike({ kind: 'rect', x: 0, y: 0, width: 1, height: 1 })).toBe(true);
  });

  it('rejects plain rect poses (no `kind` field)', () => {
    expect(isPathLike({ x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });

  it('rejects nullish and primitives', () => {
    expect(isPathLike(null)).toBe(false);
    expect(isPathLike(undefined)).toBe(false);
    expect(isPathLike(0)).toBe(false);
  });
});

describe('aabbOfPose', () => {
  it('returns path AABB for polygon poses', () => {
    expect(aabbOfPose(tri)).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('returns rect bounds for plain rect poses', () => {
    expect(aabbOfPose({ x: 4, y: 5, width: 10, height: 20 } as never)).toEqual({
      x: 4, y: 5, width: 10, height: 20,
    });
  });
});

describe('poseContains', () => {
  it('path pose: point inside the triangle is contained', () => {
    expect(poseContains(tri, 5, 5)).toBe(true);
  });

  it('path pose: point outside the triangle is not contained', () => {
    expect(poseContains(tri, 0, 9)).toBe(false);
    expect(poseContains(tri, 100, 100)).toBe(false);
  });

  it('plain rect: AABB containment', () => {
    const r = { x: 0, y: 0, width: 10, height: 10 };
    expect(poseContains(r as never, 5, 5)).toBe(true);
    expect(poseContains(r as never, 11, 5)).toBe(false);
    expect(poseContains(r as never, -1, 5)).toBe(false);
  });
});
