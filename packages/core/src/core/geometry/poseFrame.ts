/**
 * The one composition of a box pose into the matrix that carries its own
 * frame to its parent's: the rotation convention of `poseRotationOf`, and the
 * pose's residual `transform` inside it. Painting, culling, silhouettes, and
 * picking all read a pose through `poseFrameOf` so they agree on where the
 * node is.
 */
import { invert, multiply, rotateAboutPoint, type Mat3 } from '@weasel-js/geom';

/**
 * The linear part of a box pose that its box, rotation, and flips cannot
 * hold: a skew, or a scale that differs by axis. `[a, b, c, d]` in
 * `Mat3` order (`x' = a·x + c·y`, `y' = b·x + d·y`), applied about the
 * box center to what the node draws in its unrotated box, before the
 * rotation. Absent is the identity.
 *
 * The box, `rotation`, and flips keep their meaning beside it: a node at
 * `(x, y, width, height)` is laid out and painted in that box exactly as it
 * would be without a `transform`, and the result is then taken through
 * `rotate(rotation) · transform` about the box center.
 */
export type PoseLinear = readonly [a: number, b: number, c: number, d: number];

interface FramedBox {
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
export function poseFrameOf(pose: unknown): Mat3 | null {
  const p = pose as Partial<FramedBox> | null | undefined;
  if (!p || p.x == null || p.y == null || p.width == null || p.height == null) return null;
  const linear = poseLinearOf(p);
  if (!p.rotation && !linear) return null;
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  if (!linear) return rotateAboutPoint(cx, cy, p.rotation as number);
  const [a, b, c, d] = linear;
  const about: Mat3 = [a, b, c, d, cx - (a * cx + c * cy), cy - (b * cx + d * cy)];
  return p.rotation ? multiply(rotateAboutPoint(cx, cy, p.rotation), about) : about;
}

/**
 * The inverse of {@link poseFrameOf}: where a parent-frame point falls in the
 * pose's unrotated box frame. `null` when there is no frame to undo, or when
 * the `transform` is singular and nothing maps back.
 */
export function poseFrameInverseOf(pose: unknown): Mat3 | null {
  const frame = poseFrameOf(pose);
  return frame && invert(frame);
}
