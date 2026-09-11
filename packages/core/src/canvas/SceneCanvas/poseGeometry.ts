/**
 * Pose-shape helpers shared by `<SceneCanvas>` internals.
 *
 * Every bounds read goes through a `PoseDescriptor`, defaulting to
 * `AUTO_POSE_DESCRIPTOR` (path descriptor for `{kind:'polygon'|'rect'}` poses,
 * rect descriptor for everything else). Used by hit-test, marquee and bounds
 * extraction, so a consumer-supplied descriptor reaches all three.
 */
import type { Bounds } from 'tools/builtin/select';
import { applyToPoint, rotateAboutPoint } from '@weasel-js/geom';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR, isPathLike } from 'interactions/actions/resize/autoPoseDescriptor';
import { poseRotationOf } from 'features/paths/poseRotation';
import { pointInPath, strokeHitTest } from 'features/paths/hitTest';

export { isPathLike };

export function aabbOfPose<TPose>(
  pose: TPose,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
): Bounds {
  return descriptor.getBounds(pose);
}

/** Screen-px slop applied to the stroke-distance hit-test for paths. Catches
 *  fingertip-imprecision around thin lines / curves without depending on the
 *  stroke's actual rendered width (which the hit-test layer doesn't know). */
const DEFAULT_PATH_STROKE_SLOP = 4;

/**
 * @param tolerance - Grab slop in **world** units. Grows the AABB test and
 *   the path stroke-distance test alike. Defaults to
 *   {@link DEFAULT_PATH_STROKE_SLOP} for path-like poses (the historical
 *   fixed slop) and to `0` for rect poses, whose edges were never fuzzy.
 */
export function poseContains<TPose>(
  pose: TPose,
  wx: number,
  wy: number,
  tolerance?: number,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
): boolean {
  if (isPathLike(pose)) {
    // Precise inside-filled-region OR within-stroke-slop. Replaces the old
    // "AABB-conservative-fallback" path that returned true anywhere inside
    // the path's bounding box (which over-picked on open / non-convex paths).
    if (pointInPath(pose, wx, wy)) return true;
    return strokeHitTest(pose, wx, wy, tolerance ?? DEFAULT_PATH_STROKE_SLOP);
  }
  const b = aabbOfPose(pose, descriptor);
  // `tolerance` is the caller's whole budget for being at least as generous
  // as whatever refinement follows: pointer slop AND the stroke's outward
  // reach, which this function cannot see.
  const t = tolerance ?? 0;
  return wx >= b.x - t && wx <= b.x + b.width + t
      && wy >= b.y - t && wy <= b.y + b.height + t;
}

/**
 * Containment for `<SceneCanvas>`'s default `pickEvery`. When the pose carries
 * an effective rotation (`poseRotationOf`), inverse-rotates the query point
 * about the AABB center and runs the local `poseContains` — exactly mirroring
 * the renderer's rotation wrap, so the click target matches the rendered shape.
 * This covers both rect-shaped poses and rotated `kind:'rect'`/polygon poses
 * that carry an AABB. Poses with no effective rotation test directly.
 *
 * Rotation comes from the descriptor when one is supplied, and otherwise from
 * `pose.rotation` — the convention the renderer reads.
 */
export function poseContainsRotated<TPose>(
  pose: TPose,
  wx: number,
  wy: number,
  tolerance?: number,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
): boolean {
  const r = descriptor === AUTO_POSE_DESCRIPTOR
    ? poseRotationOf(pose)
    : rotationAboutCenter(pose, descriptor);
  if (r) {
    // Inverse of `rotateAboutPoint(cx, cy, θ)` is `rotateAboutPoint(cx, cy, -θ)`
    // (same pivot + negated angle) — composes on the kernel rather than the
    // bespoke trig in `rotate/geometry.rotatePoint`. Matches `pathInWorld`'s
    // inverse convention; the silhouette dispatch + stroke-slop below are
    // unchanged.
    const [lx, ly] = applyToPoint(rotateAboutPoint(r.cx, r.cy, -r.rotation), wx, wy);
    // Rotation is rigid, so a world-unit tolerance is the same distance in
    // the local frame — no rescaling needed.
    return poseContains(pose, lx, ly, tolerance, descriptor);
  }
  return poseContains(pose, wx, wy, tolerance, descriptor);
}

function rotationAboutCenter<TPose>(
  pose: TPose,
  descriptor: PoseDescriptor<unknown>,
): { cx: number; cy: number; rotation: number } | null {
  const rotation = descriptor.getRotation?.(pose) ?? 0;
  if (!rotation) return null;
  const b = descriptor.getBounds(pose);
  return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, rotation };
}
