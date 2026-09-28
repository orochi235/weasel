/**
 * An orbit camera: a target, two angles and a distance. Immutable — every
 * gesture returns a new one, so it can live in instrument state.
 *
 * This is the shape `ViewApi` cannot hold, and the reason the kernel declares a
 * `camera3d` dep of its own rather than reusing the kit's `view`.
 */

import {
  lookAt,
  multiply,
  perspective,
  type Mat4,
  type Vec3,
} from '@weasel-js/geom/3d';

/** An orbit camera. The eye sits `distance` world units from `target` at
 *  `yaw`/`pitch`; `fov` is the vertical field of view in radians, and
 *  `near`/`far` the clip distances. */
export interface Camera3d {
  target: Vec3;
  /** Radians about +y, measured from +z. */
  yaw: number;
  /** Radians above the xz plane. */
  pitch: number;
  distance: number;
  fov: number;
  near: number;
  far: number;
}

/** Short of vertical: at exactly ±π/2 the eye lands on the up axis and `lookAt` degenerates. */
export const MAX_PITCH = Math.PI / 2 - 0.01;
const MIN_DISTANCE = 0.5;
const MAX_DISTANCE = 500;
const UP: Vec3 = { x: 0, y: 1, z: 0 };

/** A camera with defaults for every field not given: origin target, level at
 *  yaw 0, distance 10, fov π/4, near 0.1, far 1000. */
export function createCamera(init: Partial<Camera3d>): Camera3d {
  return {
    target: init.target ?? { x: 0, y: 0, z: 0 },
    yaw: init.yaw ?? 0,
    pitch: init.pitch ?? 0,
    distance: init.distance ?? 10,
    fov: init.fov ?? Math.PI / 4,
    near: init.near ?? 0.1,
    far: init.far ?? 1000,
  };
}

/** The eye's world position. */
export function cameraEye(camera: Camera3d): Vec3 {
  const { target, yaw, pitch, distance } = camera;
  const horizontal = Math.cos(pitch) * distance;
  return {
    x: target.x + horizontal * Math.sin(yaw),
    y: target.y + Math.sin(pitch) * distance,
    z: target.z + horizontal * Math.cos(yaw),
  };
}

/** World-to-view matrix, with +y up. */
export function cameraView(camera: Camera3d): Mat4 {
  return lookAt(cameraEye(camera), camera.target, UP);
}

/** World-to-clip matrix for a pane of the given width/height `aspect`. */
export function cameraViewProjection(camera: Camera3d, aspect: number): Mat4 {
  return multiply(perspective(camera.fov, aspect, camera.near, camera.far), cameraView(camera));
}

/** The camera turned about its target by the given radians. Pitch is clamped
 *  to ±`MAX_PITCH`; yaw is not wrapped. */
export function orbitBy(camera: Camera3d, deltaYaw: number, deltaPitch: number): Camera3d {
  return {
    ...camera,
    yaw: camera.yaw + deltaYaw,
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, camera.pitch + deltaPitch)),
  };
}

/** The camera with its distance multiplied by `factor`, clamped to 0.5..500. */
export function dollyBy(camera: Camera3d, factor: number): Camera3d {
  return {
    ...camera,
    distance: Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, camera.distance * factor)),
  };
}
