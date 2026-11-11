/** Container composition for `Pose3`: a child's pose is stored in its
 *  container's frame, and folds up to world through every frame above it. */

import type { PoseComposition } from '@weasel-js/core/engine';
import { add, quatConjugate, quatMultiply, quatRotate, sub, type Vec3 } from '@weasel-js/geom/3d';
import type { Pose3 } from './pose3';

const times = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x * b.x, y: a.y * b.y, z: a.z * b.z });

/** `a / s` on one axis, reading a collapsed one as `zero`: nothing in a
 *  zero-scaled frame can be told apart along it, nor in one scaled too small
 *  for the quotient to be finite. */
const overAxis = (a: number, s: number, zero: number): number => {
  const q = a / s;
  return s === 0 || !Number.isFinite(q) ? zero : q;
};

const over = (a: Vec3, s: Vec3, zero: Vec3): Vec3 => ({
  x: overAxis(a.x, s.x, zero.x),
  y: overAxis(a.y, s.y, zero.y),
  z: overAxis(a.z, s.z, zero.z),
});

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * Container composition for a 3D scene: a container's position, rotation and
 * scale all reach its children, so moving, turning or growing a container
 * carries everything under it.
 *
 * Exact whenever the container's scale is uniform. Under a non-uniform one a
 * turned child would come out sheared, which no `Pose3` holds; it keeps its
 * own axes instead and takes the container's scale axis by axis. Either way
 * `decompose` undoes `compose`, so a node rebased into a frame and read back
 * lands where it was.
 */
export const POSE3_COMPOSITION: PoseComposition<Pose3> = {
  compose: (parent, child) => ({
    position: add(parent.position, quatRotate(parent.rotation, times(parent.scale, child.position))),
    rotation: quatMultiply(parent.rotation, child.rotation),
    scale: times(parent.scale, child.scale),
  }),
  decompose: (parent, world) => ({
    position: over(quatRotate(quatConjugate(parent.rotation), sub(world.position, parent.position)), parent.scale, ORIGIN),
    rotation: quatMultiply(quatConjugate(parent.rotation), world.rotation),
    scale: over(world.scale, parent.scale, world.scale),
  }),
  closure: 'rigid',
};
