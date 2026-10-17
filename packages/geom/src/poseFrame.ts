/**
 * The one composition of a box pose into the matrix that carries its own
 * frame to its parent's: the rotation convention of `poseRotationOf`, and the
 * pose's residual `transform` inside it. Painting, culling, silhouettes, and
 * picking all read a pose through `poseFrameOf` so they agree on where the
 * node is.
 */
import { invert, multiply, rotateAboutPoint, type Affine } from './affine';
import type { Path } from './path';
import { transformPath } from './paths/transformPath';
import { poseRotationOf, rotatePathAround } from './poseRotation';

/**
 * The linear part of a box pose that its box, rotation, and flips cannot
 * hold: a skew, or a scale that differs by axis. `[a, b, c, d]` in
 * `Affine` order (`x' = a·x + c·y`, `y' = b·x + d·y`), applied about the
 * box center to what the node draws in its unrotated box, before the
 * rotation. Absent is the identity.
 */
export type PoseLinear = readonly [a: number, b: number, c: number, d: number];

/**
 * Axis-aligned rectangle in world space. The optional `rotation` (radians,
 * around the AABB center) and `transform` (inside it, about the same center)
 * let chrome carry the frame a box is drawn in without a parallel type;
 * `poseFrameOf` composes the two. routing and core call it `Bounds`.
 */
export interface FramedBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  transform?: PoseLinear;
}

/** `transform` when it changes anything, `null` for absent or the identity. */
export function poseLinearOf(pose: unknown): PoseLinear | null {
  const t = (pose as { transform?: unknown } | null | undefined)?.transform;
  if (!Array.isArray(t) || t.length !== 4) return null;
  if (t[0] === 1 && t[1] === 0 && t[2] === 0 && t[3] === 1) return null;
  return t as unknown as PoseLinear;
}

/**
 * The matrix taking a point in the pose's own unrotated box frame to where
 * the node draws it: `rotate(rotation) · transform`, about the box center.
 * `null` when the pose has neither, or is not a box, so a caller can skip
 * the step.
 */
export function poseFrameOf(pose: unknown): Affine | null {
  const p = pose as Partial<FramedBox> | null | undefined;
  if (!p || p.x == null || p.y == null || p.width == null || p.height == null) return null;
  const linear = poseLinearOf(p);
  if (!p.rotation && !linear) return null;
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  if (!linear) return rotateAboutPoint(cx, cy, p.rotation as number);
  const [a, b, c, d] = linear;
  const about: Affine = [a, b, c, d, cx - (a * cx + c * cy), cy - (b * cx + d * cy)];
  return p.rotation ? multiply(rotateAboutPoint(cx, cy, p.rotation), about) : about;
}

/**
 * The inverse of {@link poseFrameOf}: where a parent-frame point falls in the
 * pose's unrotated box frame. `null` when there is no frame to undo, or when
 * the `transform` is singular and nothing maps back.
 */
export function poseFrameInverseOf(pose: unknown): Affine | null {
  if (!poseLinearOf(pose)) {
    // The same pivot turned back: exact, where inverting the matrix is not.
    const r = poseRotationOf(pose);
    return r && rotateAboutPoint(r.cx, r.cy, -r.rotation);
  }
  const frame = poseFrameOf(pose);
  return frame && invert(frame);
}

/** `path`, given in the pose's unrotated box frame, as the node draws it. */
export function pathThroughPoseFrame(path: Path, pose: unknown): Path {
  if (poseLinearOf(pose)) {
    const frame = poseFrameOf(pose);
    return frame ? transformPath(path, frame) : path;
  }
  const r = poseRotationOf(pose);
  return r ? rotatePathAround(path, r.cx, r.cy, r.rotation) : path;
}
