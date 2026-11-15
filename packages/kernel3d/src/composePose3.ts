/** Container composition for `Pose3`: a child's pose is stored in its
 *  container's frame, and folds up to world through every frame above it. */

import type { PoseComposition } from '@weasel-js/core/engine';
import { invertible } from '@weasel-js/geom';
import { add, quatConjugate, quatMultiply, quatRotate, sub, type Vec3 } from '@weasel-js/geom/3d';
import type { Pose3 } from './pose3';

const times = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x * b.x, y: a.y * b.y, z: a.z * b.z });
const over = (a: Vec3, s: Vec3): Vec3 => ({ x: a.x / s.x, y: a.y / s.y, z: a.z / s.z });
const finite = (v: Vec3): boolean => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const most = (v: Vec3): number => Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));

/** Whether a frame scaled by `s` inverts, judged as geom's `invert` judges a
 *  matrix: a zero axis, or one so small beside another that the frame's
 *  condition number passes geom's bound, does not. */
const scaleInverts = (s: Vec3): boolean =>
  invertible(most(s), Math.max(1 / Math.abs(s.x), 1 / Math.abs(s.y), 1 / Math.abs(s.z)));

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
 *
 * A container scaled to 0 on an axis is a pose it may hold, and its children
 * compose flat along that axis. `decompose` answers `null` under one, and
 * under any frame whose scale `scaleInverts` refuses or whose local pose
 * would not be finite: no local pose there composes back to the world one.
 */
export const POSE3_COMPOSITION: PoseComposition<Pose3> = {
  compose: (parent, child) => ({
    position: add(parent.position, quatRotate(parent.rotation, times(parent.scale, child.position))),
    rotation: quatMultiply(parent.rotation, child.rotation),
    scale: times(parent.scale, child.scale),
  }),
  decompose: (parent, world) => {
    if (!scaleInverts(parent.scale)) return null;
    const position = over(quatRotate(quatConjugate(parent.rotation), sub(world.position, parent.position)), parent.scale);
    const scale = over(world.scale, parent.scale);
    if (!finite(position) || !finite(scale)) return null;
    return { position, rotation: quatMultiply(quatConjugate(parent.rotation), world.rotation), scale };
  },
  closure: 'rigid',
};
