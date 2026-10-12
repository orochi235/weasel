/**
 * Pose rotation helpers. The kit applies the rotation wrap around EVERY
 * per-node `drawOne` (consumer-supplied or default), so a custom painter's
 * output turns with its selection chrome.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import { poseFrameOf } from '@weasel-js/geom';
import { rotateAboutPoint, mat3, type GlMat3 } from '@weasel-js/geom';

/** Rotation by `rotation` about `(cx, cy)` as the render-tree's column-major
 *  3×3 affine. */
export function rotationMatrixAbout(cx: number, cy: number, rotation: number): GlMat3 {
  return mat3.fromAffine(rotateAboutPoint(cx, cy, rotation));
}

/** Rotation matrix about the AABB center of `(x, y, width, height)`. The pivot
 *  matches `poseRotationOf` (the shared rotation convention). */
export function rotateAroundAABBCenter(
  x: number, y: number, width: number, height: number, rotation: number,
): GlMat3 {
  return rotationMatrixAbout(x + width / 2, y + height / 2, rotation);
}

/** Wrap a per-node draw-command list in a group carrying the pose's frame
 *  (`poseFrameOf`): its `rotation`, its `transform`, or both, about the AABB
 *  center. No-ops when `cmds` is empty, when the pose has neither field, or
 *  when any of the AABB fields are missing. */
export function wrapWithPoseRotation(
  cmds: DrawCommand[],
  pose: unknown,
): DrawCommand[] {
  if (cmds.length === 0) return cmds;
  const frame = poseFrameOf(pose);
  if (!frame) return cmds;
  return [{ kind: 'group', transform: mat3.fromAffine(frame), children: cmds }];
}
