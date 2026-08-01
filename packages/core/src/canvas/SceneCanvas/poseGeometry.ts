/**
 * Pose-shape helpers shared by `<SceneCanvas>` internals.
 *
 * Mirrors Canvas's `AUTO_POSE_DESCRIPTOR` resolution: dispatches between the
 * path descriptor (for `{kind:'polygon'|'rect'}` poses) and the rect descriptor
 * for everything else. Used by hit-test, marquee, and bounds extraction so the
 * SceneCanvas defaults work uniformly across rect-shaped and path-shaped poses.
 */
import type { Bounds } from 'tools/builtin/select';
import { applyToPoint, rotateAboutPoint } from '@weasel-js/geom';
import { RECT_POSE_DESCRIPTOR } from 'interactions/actions/resize/geometry';
import { pathPoseDescriptor } from 'features/paths/poseDescriptor';
import { poseRotationOf } from 'features/paths/poseRotation';
import { pointInPath, strokeHitTest } from 'features/paths/hitTest';
import type { Path } from 'features/paths/types';

export function isPathLike(p: unknown): p is Path {
  if (!p || typeof p !== 'object') return false;
  const k = (p as { kind?: unknown }).kind;
  return k === 'polygon' || k === 'rect';
}

export function aabbOfPose<TPose>(pose: TPose): Bounds {
  if (isPathLike(pose)) return pathPoseDescriptor.getBounds(pose);
  return RECT_POSE_DESCRIPTOR.getBounds(
    pose as { x: number; y: number; width: number; height: number },
  );
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
): boolean {
  if (isPathLike(pose)) {
    // Precise inside-filled-region OR within-stroke-slop. Replaces the old
    // "AABB-conservative-fallback" path that returned true anywhere inside
    // the path's bounding box (which over-picked on open / non-convex paths).
    if (pointInPath(pose, wx, wy)) return true;
    return strokeHitTest(pose, wx, wy, tolerance ?? DEFAULT_PATH_STROKE_SLOP);
  }
  const b = aabbOfPose(pose);
  // The pre-filter has to be at least as generous as the refinement that
  // follows it, or a hit on a shape's outline is rejected before the outline
  // is ever consulted.
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
 * Rotation is read from `pose.rotation` (the kit's one rotation convention),
 * not from an injected descriptor — the renderer reads it the same way.
 */
export function poseContainsRotated<TPose>(
  pose: TPose,
  wx: number,
  wy: number,
  tolerance?: number,
): boolean {
  const r = poseRotationOf(pose);
  if (r) {
    // Inverse of `rotateAboutPoint(cx, cy, θ)` is `rotateAboutPoint(cx, cy, -θ)`
    // (same pivot + negated angle) — composes on the kernel rather than the
    // bespoke trig in `rotate/geometry.rotatePoint`. Matches `pathInWorld`'s
    // inverse convention; the silhouette dispatch + stroke-slop below are
    // unchanged.
    const [lx, ly] = applyToPoint(rotateAboutPoint(r.cx, r.cy, -r.rotation), wx, wy);
    // Rotation is rigid, so a world-unit tolerance is the same distance in
    // the local frame — no rescaling needed.
    return poseContains(pose, lx, ly, tolerance);
  }
  return poseContains(pose, wx, wy, tolerance);
}
