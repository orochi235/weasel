/**
 * An orbit camera: a target, two angles and a distance. Immutable — every
 * gesture returns a new one, so it can live in instrument state.
 *
 * This is the shape `ViewApi` cannot hold, and the reason the kernel declares a
 * `camera3d` dep of its own rather than reusing the kit's `view`.
 */

import {
  add,
  lookAt,
  multiply,
  perspective,
  scale,
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

/** How far an orbit camera may turn and travel. Distances are in world units,
 *  so a scene measured in millimeters and one in kilometers want different ones. */
export interface OrbitLimits {
  minDistance: number;
  maxDistance: number;
  /** Radians. Held inside ±`MAX_PITCH` whatever is asked for. */
  minPitch: number;
  maxPitch: number;
}

/** Pitch short of the poles, distance 0.5..500. */
export const DEFAULT_ORBIT_LIMITS: OrbitLimits = {
  minDistance: 0.5,
  maxDistance: 500,
  minPitch: -MAX_PITCH,
  maxPitch: MAX_PITCH,
};

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The camera with its pitch and distance inside `limits`. Returns `camera`
 *  itself when it already holds. */
export function clampCamera(camera: Camera3d, limits: Partial<OrbitLimits> = {}): Camera3d {
  const l = { ...DEFAULT_ORBIT_LIMITS, ...limits };
  const pitch = clamp(camera.pitch, Math.max(-MAX_PITCH, l.minPitch), Math.min(MAX_PITCH, l.maxPitch));
  const distance = clamp(camera.distance, l.minDistance, l.maxDistance);
  if (pitch === camera.pitch && distance === camera.distance) return camera;
  return { ...camera, pitch, distance };
}

/** The camera turned about its target by the given radians, pitch held inside
 *  `limits`. Yaw is not wrapped. */
export function orbitBy(
  camera: Camera3d,
  deltaYaw: number,
  deltaPitch: number,
  limits?: Partial<OrbitLimits>,
): Camera3d {
  return clampCamera(
    { ...camera, yaw: camera.yaw + deltaYaw, pitch: camera.pitch + deltaPitch },
    limits,
  );
}

/** The camera with its distance multiplied by `factor`, held inside `limits`. */
export function dollyBy(camera: Camera3d, factor: number, limits?: Partial<OrbitLimits>): Camera3d {
  return clampCamera({ ...camera, distance: camera.distance * factor }, limits);
}

/**
 * The camera with its target slid across the screen plane, so the point at the
 * target follows a pointer that moved `dx`, `dy` CSS pixels in a pane
 * `paneHeight` pixels tall. Neither angle nor distance changes.
 */
export function panBy(camera: Camera3d, dx: number, dy: number, paneHeight: number): Camera3d {
  if (!(paneHeight > 0)) return camera;
  const perPixel = (2 * camera.distance * Math.tan(camera.fov / 2)) / paneHeight;
  const { yaw, pitch } = camera;
  const right: Vec3 = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const up: Vec3 = {
    x: -Math.sin(yaw) * Math.sin(pitch),
    y: Math.cos(pitch),
    z: -Math.cos(yaw) * Math.sin(pitch),
  };
  const shift = add(scale(right, -dx * perPixel), scale(up, dy * perPixel));
  return { ...camera, target: add(camera.target, shift) };
}

/**
 * `dollyBy` about a point on the pane rather than its middle: the point in the
 * target's screen-facing plane under `at` — CSS pixels from the pane's
 * top-left, in a pane of `pane` size — stays under it, as a 2D camera's wheel
 * zoom keeps the point under the pointer. The target slides toward that point
 * by as much as the distance shrank, so the next turn pivots nearer it.
 */
export function dollyToward(
  camera: Camera3d,
  factor: number,
  at: { x: number; y: number },
  pane: { width: number; height: number },
  limits?: Partial<OrbitLimits>,
): Camera3d {
  const dollied = dollyBy(camera, factor, limits);
  const kept = 1 - dollied.distance / camera.distance;
  const moved = panBy(
    camera,
    -kept * (at.x - pane.width / 2),
    -kept * (at.y - pane.height / 2),
    pane.height,
  );
  return { ...dollied, target: moved.target };
}
