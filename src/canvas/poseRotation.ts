/**
 * Pose rotation helpers — extracted from `SceneCanvas` so the kit can apply
 * the auto-rotation wrap around EVERY per-node `drawOne` (consumer-supplied
 * or default), not only around the default painter's output.
 *
 * Without this, consumers who supply a custom `drawOne` get no rotation
 * visualization even though selection chrome (which reads `pose.rotation`
 * directly) does rotate — the rect sits still while its chrome spins.
 *
 * `wrapWithPoseRotation` is applied inside `buildSceneLayer` (committed
 * paint) and `usePreviewGhostLayer.buildSubtree` (in-flight preview) so
 * both code paths produce rotated geometry uniformly.
 */
import type { DrawCommand } from '../renderer';

/** Compose `T(cx,cy) · R(θ) · T(-cx,-cy)` for the AABB center of `(x, y,
 *  width, height)` into a column-major 3×3 affine. Matches the
 *  `[a, b, 0, c, d, 0, tx, ty, 1]` layout `kind: 'group'` consumes. */
export function rotateAroundAABBCenter(
  x: number, y: number, width: number, height: number, rotation: number,
): Float32Array {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const cs = Math.cos(rotation);
  const sn = Math.sin(rotation);
  const a = cs, b = sn, c = -sn, d = cs;
  const tx = cx - a * cx - c * cy;
  const ty = cy - b * cx - d * cy;
  return new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
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
  const p = pose as Partial<{ x: number; y: number; width: number; height: number; rotation: number }>;
  if (p.rotation && p.x != null && p.y != null && p.width != null && p.height != null) {
    return [{
      kind: 'group',
      transform: rotateAroundAABBCenter(p.x, p.y, p.width, p.height, p.rotation),
      children: cmds,
    }];
  }
  return cmds;
}
