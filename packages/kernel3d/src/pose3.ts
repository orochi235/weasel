/**
 * A 3D pose, and the two things every consumer of one needs: its matrix, and
 * the world box it occupies.
 *
 * `Scene<TData, TLayer, Pose3>` is the whole of how this reaches weasel —
 * `Scene` is generic over its pose and holds this one with no adapter, no
 * subclass and no special case.
 */

import {
  compose, quatIdentity, transformAabb, type Aabb, type Mat4, type Quat, type Vec3,
} from '@weasel-js/geom/3d';

export interface Pose3 {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

/** The box a primitive occupies before its pose. A unit primitive centred on
 *  its own origin — which is what the kernel assumes nothing about — is
 *  `UNIT_CUBE`. */
export const UNIT_CUBE: Aabb = { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] };

export function pose3(
  position: Vec3,
  scale: Vec3 = [1, 1, 1],
  rotation: Quat = quatIdentity(),
): Pose3 {
  return { position, rotation, scale };
}

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
