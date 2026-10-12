/**
 * Pose rotation helpers — extracted from `SceneCanvas` so the kit can apply
 * the auto-rotation wrap around EVERY per-node `drawOne` (consumer-supplied
 * or default), not only around the default painter's output.
 *
 * Without this, consumers who supply a custom `drawOne` get no rotation
 * visualization even though selection chrome (which reads `pose.rotation`
 * directly) does rotate — the rect sits still while its chrome spins.
 *
 * `wrapWithPoseRotation` is applied by `wrapNodeOutput` in both scene walks —
 * `buildSceneLayer` (main canvas) and `buildSceneViewCommands` (detached
 * renders) — and directly by `usePreviewGhostLayer.buildSubtree` (in-flight
 * preview), so every code path produces rotated geometry uniformly.
 */
import type { DrawCommand } from '../renderer';
import { poseFrameOf } from '@weasel-js/geom';
import { rotateAboutPoint, mat3, type GlMat3 } from '@weasel-js/geom';

/** Rotation by `rotation` about `(cx, cy)` as the render-tree's column-major
 *  3×3 affine. Composes on the kernel's `rotateAboutPoint` (single owner of the
 *  rotate-about-point math); this only reshapes 6→9 for the WebGL upload. */
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
 *  center, matching the rotation-handle math, `pathInWorld`, and picking so
 *  chrome and geometry stay aligned.
 *
 *  No-ops when `cmds` is empty, when the pose has neither field, or when any
 *  of the AABB fields are missing (the wrap requires a center to turn about).
 *  Painters / consumers that need different semantics (e.g. pivot at origin)
 *  should still wrap themselves. */
export function wrapWithPoseRotation(
  cmds: DrawCommand[],
  pose: unknown,
): DrawCommand[] {
  if (cmds.length === 0) return cmds;
  const frame = poseFrameOf(pose);
  if (!frame) return cmds;
  return [{ kind: 'group', transform: mat3.fromAffine(frame), children: cmds }];
}
