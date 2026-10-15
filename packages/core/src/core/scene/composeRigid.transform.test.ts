import { describe, expect, it } from 'vitest';
import { applyToPoint, multiply, poseFrameOf, translate, type Affine } from '@weasel-js/geom';
import { composeRigidPose, decomposeRigidPose } from 'core/scene/composePose';
import type { RectPose } from 'core/scene/types';

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** Where a pose draws its box corners in the frame it is expressed in. */
function corners(p: RectPose, outer: Affine = IDENTITY): [number, number][] {
  const m = multiply(outer, poseFrameOf(p) ?? IDENTITY);
  return ([[p.x, p.y], [p.x + p.width, p.y], [p.x + p.width, p.y + p.height], [p.x, p.y + p.height]] as const)
    .map(([x, y]) => applyToPoint(m, x, y));
}

/** The matrix a container's pose puts its children through: its own frame,
 *  over the offset of its unrotated box. */
function childFrameOf(parent: RectPose): Affine {
  return multiply(poseFrameOf(parent) ?? IDENTITY, translate(parent.x, parent.y));
}

function maxError(a: [number, number][], b: [number, number][]): number {
  return Math.max(...a.map(([x, y], i) => Math.hypot(x - b[i][0], y - b[i][1])));
}

const SKEWED: RectPose = { x: 100, y: 40, width: 200, height: 120, rotation: 0.7, transform: [1.5, 0, 0.4, 0.8] };
const CHILD: RectPose = { x: 15, y: 25, width: 60, height: 40, rotation: -0.3 };
const SKEWED_CHILD: RectPose = { ...CHILD, transform: [1, 0.2, -0.3, 1.1] };

describe('composeRigidPose under a container that carries a transform', () => {
  it('puts a plain child where the container frame puts its corners', () => {
    const world = composeRigidPose(SKEWED, CHILD);
    expect(maxError(corners(world), corners(CHILD, childFrameOf(SKEWED)))).toBeLessThan(1e-9);
  });

  it('composes the container transform with the child own', () => {
    const world = composeRigidPose(SKEWED, SKEWED_CHILD);
    expect(maxError(corners(world), corners(SKEWED_CHILD, childFrameOf(SKEWED)))).toBeLessThan(1e-9);
  });

  it('keeps the child box size and sums the rotations', () => {
    const world = composeRigidPose(SKEWED, CHILD);
    expect(world.width).toBe(60);
    expect(world.height).toBe(40);
    expect(world.rotation).toBeCloseTo(0.4, 12);
  });

  it('writes no transform under a container that has none', () => {
    const plain: RectPose = { x: 100, y: 40, width: 200, height: 120, rotation: 0.7 };
    expect('transform' in composeRigidPose(plain, CHILD)).toBe(false);
    expect(composeRigidPose(plain, SKEWED_CHILD).transform).toEqual(SKEWED_CHILD.transform);
  });
});

describe('decomposeRigidPose under a container that carries a transform', () => {
  it.each([['plain', CHILD], ['skewed', SKEWED_CHILD]])('round-trips a %s child', (_name, child) => {
    const local = decomposeRigidPose(SKEWED, composeRigidPose(SKEWED, child));
    expect(maxError(corners(local), corners(child))).toBeLessThan(1e-9);
    expect(local.rotation).toBeCloseTo(child.rotation ?? 0, 12);
  });

  it('answers a child with no transform of its own without one', () => {
    const local = decomposeRigidPose(SKEWED, composeRigidPose(SKEWED, CHILD));
    expect(local.transform).toBeUndefined();
  });
});
