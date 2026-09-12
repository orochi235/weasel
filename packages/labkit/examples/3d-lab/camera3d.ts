/**
 * An orbit camera: a target, two angles and a distance. Immutable — every
 * gesture returns a new one, so it can live in instrument state.
 *
 * This is the shape `ViewApi` cannot hold, and the reason the lab registers a
 * `camera3d` dep of its own rather than the kit's `view`.
 */

import {
  lookAt,
  multiply,
  perspective,
  type Mat4,
  type Vec3,
} from './math3d';

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
const UP: Vec3 = [0, 1, 0];

export function createCamera(init: Partial<Camera3d>): Camera3d {
  return {
    target: init.target ?? [0, 0, 0],
    yaw: init.yaw ?? 0,
    pitch: init.pitch ?? 0,
    distance: init.distance ?? 10,
    fov: init.fov ?? Math.PI / 4,
    near: init.near ?? 0.1,
    far: init.far ?? 1000,
  };
}

export function cameraEye(camera: Camera3d): Vec3 {
  const { target, yaw, pitch, distance } = camera;
  const horizontal = Math.cos(pitch) * distance;
  return [
    target[0] + horizontal * Math.sin(yaw),
    target[1] + Math.sin(pitch) * distance,
    target[2] + horizontal * Math.cos(yaw),
  ];
}

export function cameraView(camera: Camera3d): Mat4 {
  return lookAt(cameraEye(camera), camera.target, UP);
}

export function cameraViewProjection(camera: Camera3d, aspect: number): Mat4 {
  return multiply(perspective(camera.fov, aspect, camera.near, camera.far), cameraView(camera));
}

export function orbitBy(camera: Camera3d, deltaYaw: number, deltaPitch: number): Camera3d {
  return {
    ...camera,
    yaw: camera.yaw + deltaYaw,
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, camera.pitch + deltaPitch)),
  };
}

export function dollyBy(camera: Camera3d, factor: number): Camera3d {
  return {
    ...camera,
    distance: Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, camera.distance * factor)),
  };
}
