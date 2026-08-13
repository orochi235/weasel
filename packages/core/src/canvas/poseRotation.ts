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
import { poseRotationOf } from 'features/paths/poseRotation';
import { rotateAboutPoint, type Mat3 } from '@weasel-js/geom';

/** Expand a kernel 6-tuple affine `[a, b, c, d, e, f]` (DOMMatrix order) into
 *  the 9-element column-major `[a, b, 0, c, d, 0, tx, ty, 1]` `Float32Array`
 *  the `kind: 'group'` DrawCommand wrap consumes for `uniformMatrix3fv`. Pure
 *  shape glue — the rotate-about-point MATH lives in the kernel. */
function mat3ToRenderMatrix(m: Mat3): Float32Array {
  return new Float32Array([m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);
}

/** Rotation by `rotation` about `(cx, cy)` as the render-tree's column-major
 *  3×3 affine. Composes on the kernel's `rotateAboutPoint` (single owner of the
 *  rotate-about-point math); this only reshapes 6→9 for the WebGL upload. */
function rotationMatrixAbout(cx: number, cy: number, rotation: number): Float32Array {
  return mat3ToRenderMatrix(rotateAboutPoint(cx, cy, rotation));
}

/** Rotation matrix about the AABB center of `(x, y, width, height)`. The pivot
 *  matches `poseRotationOf` (the shared rotation convention). */
export function rotateAroundAABBCenter(
  x: number, y: number, width: number, height: number, rotation: number,
): Float32Array {
  return rotationMatrixAbout(x + width / 2, y + height / 2, rotation);
}

/** Wrap a per-node draw-command list in a rotation group when the pose
 *  carries a non-zero `rotation` and AABB fields (`x`, `y`, `width`,
 *  `height`). The wrap rotates the emitted geometry around the AABB
 *  center, matching the rotation-handle math and `pathInWorld` so chrome
 *  + geometry stay aligned.
 *
 *  No-ops when `cmds` is empty, when `pose.rotation` is missing/zero, or
 *  when any of the AABB fields are missing (the wrap requires a center
 *  to rotate about). Painters / consumers that need different rotation
 *  semantics (e.g. pivot at origin) should still wrap themselves. */
export function wrapWithPoseRotation(
  cmds: DrawCommand[],
  pose: unknown,
): DrawCommand[] {
  if (cmds.length === 0) return cmds;
  const r = poseRotationOf(pose);
  if (!r) return cmds;
  return [{
    kind: 'group',
    transform: rotationMatrixAbout(r.cx, r.cy, r.rotation),
    children: cmds,
  }];
}
