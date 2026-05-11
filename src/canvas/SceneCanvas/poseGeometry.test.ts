/**
 * Tests for the `<SceneCanvas>`-internal pose-shape dispatcher. Three
 * helpers — `isPathLike`, `aabbOfPose`, `poseContains` — route between
 * path-pose math and rect-pose math depending on the pose's `kind` tag.
 */
import { describe, it, expect } from 'vitest';
import { isPathLike, aabbOfPose, poseContains, poseContainsRotated } from './poseGeometry';
import {
  PATH_M,
  PATH_L,
  PATH_Z,
  type PolygonPath,
} from 'features/paths/types';
import type { RotatedPose } from 'interactions/gestures/types';

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

describe('poseContainsRotated', () => {
  // A tall, thin rect centered at (50, 50), 60 wide × 10 tall, rotated 90°.
  // After rotation it's 10 wide × 60 tall in world space, so points like
  // (50, 75) lie inside the rotated body but outside the AABB; points like
  // (75, 50) lie inside the AABB but outside the rotated body.
  const rotated: RotatedPose = {
    x: 20,
    y: 45,
    width: 60,
    height: 10,
    rotation: Math.PI / 2,
  };
  const getRotation = (p: RotatedPose): number => p.rotation;

  it('hits inside the rotated body even when outside the AABB', () => {
    // (50, 75): outside AABB [20..80] × [45..55], but inside rotated body.
    expect(poseContains(rotated, 50, 75)).toBe(false);
    expect(poseContainsRotated(rotated, 50, 75, getRotation)).toBe(true);
  });

  it('misses inside the AABB but outside the rotated body', () => {
    // (75, 50): inside AABB, outside the 90°-rotated thin strip.
    expect(poseContains(rotated, 75, 50)).toBe(true);
    expect(poseContainsRotated(rotated, 75, 50, getRotation)).toBe(false);
  });

  it('with no getRotation, behavior matches poseContains (AABB)', () => {
    expect(poseContainsRotated(rotated, 50, 75, undefined)).toBe(false);
    expect(poseContainsRotated(rotated, 75, 50, undefined)).toBe(true);
  });

  it('rotation==0 degenerates to AABB containment', () => {
    const r: RotatedPose = { x: 0, y: 0, width: 10, height: 10, rotation: 0 };
    expect(poseContainsRotated(r, 5, 5, getRotation)).toBe(true);
    expect(poseContainsRotated(r, 11, 5, getRotation)).toBe(false);
  });

  it('path-shaped poses ignore getRotation and use path containment', () => {
    // Even if a getRotation is wired, path-shaped poses must keep using their
    // path test — the rotated branch is for rect-shaped poses only.
    const getRot = (_p: unknown): number => Math.PI / 4;
    expect(poseContainsRotated(tri, 5, 5, getRot as never)).toBe(true);
    expect(poseContainsRotated(tri, 100, 100, getRot as never)).toBe(false);
  });
});
