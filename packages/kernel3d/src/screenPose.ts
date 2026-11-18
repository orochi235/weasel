/**
 * Screen rectangles and deltas resolved into 3D poses. A screen rectangle names
 * a pose only once something says how far away it is; each of these takes the
 * depth the pose already has.
 */

import { aabbOfPoints, add, dot, len, quatIdentity, scale as scaleBy, sub, type Vec3 } from '@weasel-js/geom/3d';
import { cameraBasis } from './camera';
import type { Axis } from './ground';
import type { Pose3 } from './pose3';
import type { ScreenRect } from './screen';
import { castOntoPlane, type Viewport3d } from './project';


/**
 * The plane through `p` that faces the camera.
 *
 * This is the depth choice the kit's reverse contracts need: a screen
 * rectangle names a pose only once something says how far away it is, and the
 * answer is "as far as it already was". Nothing resolved on this plane changes
 * depth, and one screen pixel is the same world distance everywhere on it.
 */
function viewPlaneAt(vp: Viewport3d, p: Vec3): { normal: Vec3; offset: number } {
  const normal = cameraBasis(vp.camera, vp.up).forward;
  return { normal, offset: dot(normal, p) };
}

/** Where a screen point lands on `plane`, or `null` when it casts no ray. */
function onPlane(
  vp: Viewport3d,
  plane: { normal: Vec3; offset: number },
  point: { x: number; y: number },
): Vec3 | null {
  return castOntoPlane(vp, point, plane.normal, plane.offset);
}

/** `pose` moved by `delta`, kept at its own height along `upAxis`. */
function movedOnLevel(pose: Pose3, delta: Vec3, upAxis: Axis): Pose3 {
  const position = { ...add(pose.position, delta), [upAxis]: pose.position[upAxis] };
  return { ...pose, position };
}

/** `pose` dragged `d` on screen from the middle of `box`, its screen box, across the plane through it normal to `up`. */
export function draggedOnLevel(
  vp: Viewport3d, box: ScreenRect, pose: Pose3,
  d: { x: number; y: number }, up: Vec3, upAxis: Axis,
): Pose3 {
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const level = { normal: up, offset: dot(up, pose.position) };
  const before = onPlane(vp, level, from);
  const after = onPlane(vp, level, { x: from.x + d.x, y: from.y + d.y });
  return before && after ? movedOnLevel(pose, sub(after, before), upAxis) : pose;
}

/**
 * `pose`, whose screen box is `box`, under the src→dst screen map, applied at the pose's own
 * depth: the node's screen anchor moves the way the rectangle does, and both ends of that
 * move are read back off the plane through its position, so the world delta is exact rather
 * than a scaled screen one.
 *
 * The scale is uniform. The rectangle names two extents and a pose has
 * three, so there is no reading in which a screen box resizes a solid
 * per-axis; the geometric mean is the one factor that agrees with both
 * of the extents it does name.
 */
export function remappedPose(vp: Viewport3d, box: ScreenRect, pose: Pose3, src: ScreenRect, dst: ScreenRect): Pose3 {
  const kx = src.width === 0 ? 1 : dst.width / src.width;
  const ky = src.height === 0 ? 1 : dst.height / src.height;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const to = {
    x: from.x + (dst.x - src.x) + (from.x - src.x) * (kx - 1),
    y: from.y + (dst.y - src.y) + (from.y - src.y) * (ky - 1),
  };

  const plane = viewPlaneAt(vp, pose.position);
  const before = onPlane(vp, plane, from);
  const after = onPlane(vp, plane, to);
  if (!before || !after) return pose;

  const k = Math.sqrt(Math.abs(kx * ky));
  return {
    ...pose,
    position: add(pose.position, sub(after, before)),
    scale: scaleBy(pose.scale, k),
  };
}

/**
 * The world box `bounds` covers at the template's depth, as a pose; the template when a corner
 * casts no ray.
 *
 * The rectangle is flat and a box is not, so the third extent — the one
 * no screen rectangle names — is the mean of the two it does. The result
 * is world-axis-aligned and unrotated: the pose carries none of the
 * template's shape, which is the contract, and it takes only its depth.
 *
 * Extents are written as `scale`, so this reads a pose as carrying a
 * unit primitive — the same assumption `aabbOfPose` makes by default.
 */
export function poseFromBounds(vp: Viewport3d, bounds: ScreenRect, template: Pose3): Pose3 {
  const plane = viewPlaneAt(vp, template.position);

  const corners: Vec3[] = [];
  for (const [x, y] of [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x, bounds.y + bounds.height],
    [bounds.x + bounds.width, bounds.y + bounds.height],
  ]) {
    const corner = onPlane(vp, plane, { x, y });
    if (!corner) return template;
    corners.push(corner);
  }

  const width = len(sub(corners[1]!, corners[0]!));
  const height = len(sub(corners[2]!, corners[0]!));
  const half = Math.sqrt(width * height) / 2;
  const box = aabbOfPoints(
    corners.flatMap((c) => [
      add(c, scaleBy(plane.normal, half)),
      sub(c, scaleBy(plane.normal, half)),
    ]),
  )!;
  return {
    position: scaleBy(add(box.min, box.max), 0.5),
    rotation: quatIdentity(),
    scale: sub(box.max, box.min),
  };
}
