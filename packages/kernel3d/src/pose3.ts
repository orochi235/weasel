/**
 * A 3D pose, and the two things every consumer of one needs: its matrix, and
 * the world box it occupies.
 *
 * `Scene<TData, TLayer, Pose3>` is the whole of how this reaches weasel —
 * `Scene` is generic over its pose and holds this one with no adapter, no
 * subclass and no special case.
 */

import {
  compose, quatIdentity, quatRotate, transformAabb, type Aabb, type Mat4, type Quat, type Vec3,
} from '@weasel-js/geom/3d';

/** Position, rotation and scale of a 3D node. */
export interface Pose3 {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

/** The box a primitive occupies before its pose. A unit primitive centred on
 *  its own origin — which is what the kernel assumes nothing about — is
 *  `UNIT_CUBE`. */
export const UNIT_CUBE: Aabb = {
  min: { x: -0.5, y: -0.5, z: -0.5 },
  max: { x: 0.5, y: 0.5, z: 0.5 },
};

/** A pose at `position`, unscaled and unrotated unless given. */
export function pose3(
  position: Vec3,
  scale: Vec3 = { x: 1, y: 1, z: 1 },
  rotation: Quat = quatIdentity(),
): Pose3 {
  return { position, rotation, scale };
}

/** The pose as a matrix: scale, then rotation, then translation to
 *  `position`. */
export function poseMatrix(pose: Pose3): Mat4 {
  return compose(pose.position, pose.rotation, pose.scale);
}

/**
 * The world box a posed primitive occupies, given the box it occupies in its
 * own space.
 *
 * Which local box a primitive has is the consumer's answer, not the kernel's:
 * a sphere's is rotation-invariant and a mesh's comes from its vertices, and
 * neither is something a pose can tell you.
 */
export function aabbOfPose(pose: Pose3, local: Aabb = UNIT_CUBE): Aabb {
  return transformAabb(poseMatrix(pose), local);
}

/** How near, relative to it, a box's extent counts as unchanged. */
const SAME_EXTENT = 1e-12;

/**
 * A pose like `pose` whose world box, of the primitive whose own box is
 * `local`, is `box`: moved and scaled to it, its rotation kept. Exact for an
 * unrotated pose; a rotated one is scaled per axis of its world box, which a
 * rotated box only approximates. A box that only moves, its extents the same to
 * within rounding, keeps the scale exactly.
 */
export function withAabb(pose: Pose3, box: Aabb, local: Aabb = UNIT_CUBE): Pose3 {
  const now = aabbOfPose(pose, local);
  const ratio = (axis: 'x' | 'y' | 'z'): number => {
    const was = now.max[axis] - now.min[axis];
    const to = box.max[axis] - box.min[axis];
    // A box moved by adding to both corners comes back a rounding off its old extent.
    return was === 0 || Math.abs(to - was) <= SAME_EXTENT * Math.abs(was) ? 1 : to / was;
  };
  const k = { x: ratio('x'), y: ratio('y'), z: ratio('z') };
  const mid = (b: Aabb, axis: 'x' | 'y' | 'z') => b.min[axis] + (b.max[axis] - b.min[axis]) / 2;
  if (k.x === 1 && k.y === 1 && k.z === 1) {
    return {
      ...pose,
      position: {
        x: pose.position.x + (box.min.x - now.min.x),
        y: pose.position.y + (box.min.y - now.min.y),
        z: pose.position.z + (box.min.z - now.min.z),
      },
    };
  }
  const scale = { x: pose.scale.x * k.x, y: pose.scale.y * k.y, z: pose.scale.z * k.z };
  // Where the local box's center lands, relative to the position, once scaled and rotated.
  const c = quatRotate(pose.rotation, {
    x: mid(local, 'x') * scale.x, y: mid(local, 'y') * scale.y, z: mid(local, 'z') * scale.z,
  });
  return {
    ...pose,
    scale,
    position: { x: mid(box, 'x') - c.x, y: mid(box, 'y') - c.y, z: mid(box, 'z') - c.z },
  };
}
