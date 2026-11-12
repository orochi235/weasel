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
  normalize,
  perspective,
  scale,
  sub,
  type Mat4,
  type Vec3,
} from '@weasel-js/geom/3d';
import { clamp } from '@weasel-js/geom';

/** An orbit camera. The eye sits `distance` world units from `target` at
 *  `yaw`/`pitch`; `fov` is the vertical field of view in radians, and
 *  `near`/`far` the clip distances. */
export interface Camera3d {
  target: Vec3;
  /** Radians about `up`. At yaw 0 the eye sits where the turn that carries +y onto `up` carries +z: down +z when
   *  `up` is +y, down -y when it is +z. */
  yaw: number;
  /** Radians above the ground, the plane at right angles to `up`. */
  pitch: number;
  distance: number;
  fov: number;
  near: number;
  far: number;
  /** The axis the camera orbits about and keeps upright on screen: the world's `up` (`World3d.up`). Default +y. */
  up?: Vec3;
}

/** Short of vertical: at exactly ±π/2 the eye lands on the up axis and `lookAt` degenerates. */
export const MAX_PITCH = Math.PI / 2 - 0.01;
const Y_UP: Vec3 = { x: 0, y: 1, z: 0 };

/** A camera with defaults for every field not given: origin target, level at
 *  yaw 0, distance 10, fov π/4, near 0.1, far 1000, +y up. */
export function createCamera(init: Partial<Camera3d>): Camera3d {
  return {
    target: init.target ?? { x: 0, y: 0, z: 0 },
    yaw: init.yaw ?? 0,
    pitch: init.pitch ?? 0,
    distance: init.distance ?? 10,
    fov: init.fov ?? Math.PI / 4,
    near: init.near ?? 0.1,
    far: init.far ?? 1000,
    ...(init.up ? { up: init.up } : {}),
  };
}

/** Where a +y-up camera's x, y and z axes lie in a world with `up` up: the shortest turn carrying +y onto `up`. `null`
 *  for +y itself, so a +y-up camera's arithmetic runs on its own numbers rather than through a multiply by 1 and 0. */
type OrbitFrame = { x: Vec3; y: Vec3; z: Vec3 } | null;

function orbitFrame(up: Vec3 | undefined): OrbitFrame {
  if (!up) return null;
  const u = normalize(up);
  // An `up` with no direction, or none finite, is no `up`: +y.
  if (!Number.isFinite(u.x + u.y + u.z) || (u.x === 0 && u.z === 0 && !(u.y < 0))) return null;
  const c = u.y;
  // Straight down has no shortest turn; take the half turn about x.
  if (1 + c < 1e-12) return { x: { x: 1, y: 0, z: 0 }, y: u, z: { x: 0, y: 0, z: -1 } };
  const k = 1 / (1 + c);
  return {
    x: { x: c + u.z * u.z * k, y: -u.x, z: -u.x * u.z * k },
    y: u,
    z: { x: -u.x * u.z * k, y: -u.z, z: c + u.x * u.x * k },
  };
}

function inFrame(frame: OrbitFrame, v: Vec3): Vec3 {
  if (!frame) return v;
  return add(add(scale(frame.x, v.x), scale(frame.y, v.y)), scale(frame.z, v.z));
}

/** Where a camera stands and which ways it faces, in world terms. `right` and `up` are the screen's +x and its upward
 *  direction, unit length, `forward` the unit direction from the eye to the target. */
export interface CameraBasis {
  eye: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  /** The axis the camera orbits about: `camera.up`, unit length. */
  orbitUp: Vec3;
}

/** The camera's basis: every reading of where it is and how it is turned goes through this one. */
export function cameraBasis(camera: Camera3d): CameraBasis {
  const { target, yaw, pitch, distance } = camera;
  const frame = orbitFrame(camera.up);
  const horizontal = Math.cos(pitch) * distance;
  const offset = inFrame(frame, {
    x: horizontal * Math.sin(yaw),
    y: Math.sin(pitch) * distance,
    z: horizontal * Math.cos(yaw),
  });
  const eye = { x: target.x + offset.x, y: target.y + offset.y, z: target.z + offset.z };
  return {
    eye,
    forward: normalize(sub(target, eye)),
    right: inFrame(frame, { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }),
    up: inFrame(frame, {
      x: -Math.sin(yaw) * Math.sin(pitch),
      y: Math.cos(pitch),
      z: -Math.cos(yaw) * Math.sin(pitch),
    }),
    orbitUp: frame ? frame.y : Y_UP,
  };
}

/** The eye's world position. */
export function cameraEye(camera: Camera3d): Vec3 {
  return cameraBasis(camera).eye;
}

/** World-to-view matrix, upright about the camera's `up`. */
export function cameraView(camera: Camera3d): Mat4 {
  const { eye, orbitUp } = cameraBasis(camera);
  return lookAt(eye, camera.target, orbitUp);
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

/** The camera with its pitch and distance inside `limits`. Returns `camera`
 *  itself when it already holds. */
export function clampCamera(camera: Camera3d, limits: Partial<OrbitLimits> = {}): Camera3d {
  const l = { ...DEFAULT_ORBIT_LIMITS, ...limits };
  const pitch = clamp(camera.pitch, clamp(l.minPitch, -MAX_PITCH, MAX_PITCH), clamp(l.maxPitch, -MAX_PITCH, MAX_PITCH));
  const distance = clamp(camera.distance, l.minDistance, l.maxDistance);
  if (pitch === camera.pitch && distance === camera.distance) return camera;
  return { ...camera, pitch, distance };
}

/** `moved`, or `camera` itself where a gesture would leave its place or
 *  angles not finite: an input that is `NaN` or carries it past the double
 *  range moves nothing, rather than leaving a camera that draws nothing. */
function heldFinite(camera: Camera3d, moved: Camera3d): Camera3d {
  const { target: t, yaw, pitch, distance } = moved;
  return Number.isFinite(t.x + t.y + t.z + yaw + pitch + distance) ? moved : camera;
}

/** The camera turned about its target by the given radians, pitch held inside
 *  `limits`. Yaw is not wrapped. A turn that is not finite leaves it as it is. */
export function orbitBy(
  camera: Camera3d,
  deltaYaw: number,
  deltaPitch: number,
  limits?: Partial<OrbitLimits>,
): Camera3d {
  return heldFinite(camera, clampCamera(
    { ...camera, yaw: camera.yaw + deltaYaw, pitch: camera.pitch + deltaPitch },
    limits,
  ));
}

/** The camera with its distance multiplied by `factor`, held inside `limits`.
 *  A `NaN` factor leaves it as it is. */
export function dollyBy(camera: Camera3d, factor: number, limits?: Partial<OrbitLimits>): Camera3d {
  return heldFinite(camera, clampCamera({ ...camera, distance: camera.distance * factor }, limits));
}

/**
 * The camera with its target slid across the screen plane, so the point at the
 * target follows a pointer that moved `dx`, `dy` CSS pixels in a pane
 * `paneHeight` pixels tall. Neither angle nor distance changes. A pan that
 * carries the target past the double range leaves the camera as it is.
 */
export function panBy(camera: Camera3d, dx: number, dy: number, paneHeight: number): Camera3d {
  if (!(paneHeight > 0)) return camera;
  const perPixel = (2 * camera.distance * Math.tan(camera.fov / 2)) / paneHeight;
  const { right, up } = cameraBasis(camera);
  const shift = add(scale(right, -dx * perPixel), scale(up, dy * perPixel));
  return heldFinite(camera, { ...camera, target: add(camera.target, shift) });
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
  // A camera on its target has no point under the pointer to keep.
  const kept = camera.distance > 0 ? 1 - dollied.distance / camera.distance : 0;
  const moved = panBy(
    camera,
    -kept * (at.x - pane.width / 2),
    -kept * (at.y - pane.height / 2),
    pane.height,
  );
  return heldFinite(camera, { ...dollied, target: moved.target });
}
