/**
 * Pose-shape helpers shared by `<SceneCanvas>` internals.
 *
 * Every bounds read goes through a `PoseDescriptor`, defaulting to
 * `AUTO_POSE_DESCRIPTOR` (path descriptor for `{kind:'polygon'|'rect'}` poses,
 * rect descriptor for everything else). Used by hit-test, marquee and bounds
 * extraction, so a consumer-supplied descriptor reaches all three.
 */
import type { Bounds } from 'tools/builtin/select';
import { applyToPoint, pointInPath, rotateAboutPoint, strokeHitTest } from '@weasel-js/geom';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR, isPathLike } from 'interactions/actions/resize/autoPoseDescriptor';
import { poseRotationOf } from 'core/geometry/poseRotation';
import { hasSlop, slopForStrokeHit, type ScreenSlop } from 'core/viewport/screenSlop';

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

/** A containment slop: `reach` world units the caller knows the ink extends
 *  past the pose (a stroke's outward half-width), then `px`/`scale` of screen
 *  slop measured from there. */
export interface PoseSlop extends ScreenSlop {
  reach?: number;
}

/**
 * @param tolerance - Grab slop. A number is **world** units and grows the
 *   AABB test and the path stroke-distance test alike; a {@link PoseSlop}
 *   is measured on screen, from `reach` world units out. Defaults to
 *   {@link DEFAULT_PATH_STROKE_SLOP} for path-like poses (the historical
 *   fixed slop) and to `0` for rect poses, whose edges were never fuzzy.
 */
export function poseContains<TPose>(
  pose: TPose,
  wx: number,
  wy: number,
  tolerance?: number | PoseSlop,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
): boolean {
  return containsInFrame(pose, wx, wy, tolerance, descriptor, 0);
}

/**
 * Containment for `<SceneCanvas>`'s default `pickEvery`. When the pose carries
 * an effective rotation (`poseRotationOf`), inverse-rotates the query point
 * about the AABB center and tests in the pose's own frame — exactly mirroring
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
  tolerance?: number | PoseSlop,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
): boolean {
  const r = descriptor === AUTO_POSE_DESCRIPTOR
    ? poseRotationOf(pose)
    : rotationAboutCenter(pose, descriptor);
  if (r) {
    // Inverse of `rotateAboutPoint(cx, cy, θ)` is `rotateAboutPoint(cx, cy, -θ)`
    // (same pivot + negated angle). Rotation is rigid, so world reach carries
    // over unchanged; a screen slop does not, and gets the rotation passed on.
    const [lx, ly] = applyToPoint(rotateAboutPoint(r.cx, r.cy, -r.rotation), wx, wy);
    return containsInFrame(pose, lx, ly, tolerance, descriptor, r.rotation);
  }
  return containsInFrame(pose, wx, wy, tolerance, descriptor, 0);
}

/** `(x, y)` is in the pose's own frame, which reaches world by `rotation`. */
function containsInFrame<TPose>(
  pose: TPose,
  x: number,
  y: number,
  tolerance: number | PoseSlop | undefined,
  descriptor: PoseDescriptor<unknown>,
  rotation: number,
): boolean {
  const pathLike = isPathLike(pose);
  const reach = tolerance === undefined
    ? (pathLike ? DEFAULT_PATH_STROKE_SLOP : 0)
    : typeof tolerance === 'number' ? tolerance : (tolerance.reach ?? 0);
  const screen = typeof tolerance === 'object' ? tolerance : undefined;
  const { opts } = slopForStrokeHit(screen, rotation);
  if (pathLike) {
    // Precise inside-filled-region OR within-stroke-slop. Replaces the old
    // "AABB-conservative-fallback" path that returned true anywhere inside
    // the path's bounding box (which over-picked on open / non-convex paths).
    if (pointInPath(pose, x, y)) return true;
    return strokeHitTest(pose, x, y, reach, opts);
  }
  const b = aabbOfPose(pose, descriptor);
  // `reach` is the caller's budget for being at least as generous as whatever
  // refinement follows: the stroke's outward reach, which this function
  // cannot see. Grown square, so it contains the round band the refinement
  // tests.
  const grown = {
    kind: 'rect' as const,
    x: b.x - reach, y: b.y - reach, width: b.width + 2 * reach, height: b.height + 2 * reach,
  };
  if (pointInPath(grown, x, y)) return true;
  return hasSlop(screen) && strokeHitTest(grown, x, y, 0, opts);
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
