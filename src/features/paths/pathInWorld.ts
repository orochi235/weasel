/**
 * Project a leaf path from its source frame into world coordinates given a
 * `{x, y, width, height, rotation?}` pose. Two transforms compose, in this
 * order:
 *
 *   1. Translate so the path's source AABB origin lands at `pose.x, pose.y`.
 *   2. If `pose.rotation` is nonzero, rotate every coord about the unrotated
 *      AABB center — i.e. `(pose.x + pose.width/2, pose.y + pose.height/2)`,
 *      matching `SceneCanvas.rotateAroundAABBCenter` so the baked geometry
 *      lines up with what the renderer draws.
 *
 * RectPaths can't carry rotation as-is (they're axis-aligned by definition);
 * a non-zero `pose.rotation` on a rect promotes the result to a polygon so
 * the four corners are baked into world coords. Callers that need to keep
 * the rect fast-path can pre-check `pose.rotation` themselves.
 *
 * Used by adapters that need true world geometry — most notably boolean ops,
 * where operating on the unrotated source path produces wrong shapes.
 */

import { boxToBox, rotateAboutPoint } from '@weasel-js/geom';
import { boundsOfPath } from './bounds';
import { type Path, type PolygonPath } from './types';
import { translatePath } from './transform';
import { transformPath } from './transformPath';
import { poseRotationOf, rotatePathAround } from './poseRotation';

/** Subset of pose fields this helper consumes. Matches the kit's auto-rotate
 *  convention (`SceneCanvas.defaultDrawOne`): `x/y/width/height` define an
 *  AABB whose unrotated center is the rotation pivot. */
export interface PathInWorldPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/**
 * Project a stored path into the pose's **local frame** — translate (and, for
 * rects, rebase to the pose's `width`/`height`) so the path's AABB origin sits
 * at the pose origin. This is translate-only: it does NOT apply
 * `pose.rotation`. Callers that want the fully world-positioned (rotated) path
 * should use `pathInWorld`, which composes this with the rotation wrap.
 *
 * Rects rebase onto the pose's `width`/`height` because resize updates the pose,
 * not the stored `RectPath` — so the live size lives on the pose. Honoring it
 * here keeps this in lockstep with the renderer (`SceneCanvas` paints the rect
 * at `pose.width/height`); otherwise world-space consumers (slice, booleans,
 * release-compound) would operate on the stale pre-resize dimensions.
 *
 * Used by the local seams: the default painter (paint + silhouette), and as the
 * building block `pathInWorld`/`findShapeSilhouette` rotate on top of.
 */
export function pathInPoseFrame(path: Path, pose: PathInWorldPose): Path {
  if (path.kind === 'rect') {
    if (
      path.x === pose.x && path.y === pose.y
      && path.width === pose.width && path.height === pose.height
    ) return path;
    return { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height };
  }
  // Polygon: rebase the path's own AABB into the pose box via a box→box affine.
  // Identity when the bounds already equal the pose box (geometry already tracks
  // the pose) — behavior-preserving there; for geometry-in-data nodes whose pose
  // box was resized independently, it scales the contents to fill the box,
  // fixing the anchor bug.
  const b = boundsOfPath(path);
  if (b.x === pose.x && b.y === pose.y && b.width === pose.width && b.height === pose.height) {
    return path;
  }
  const m = boxToBox(b.x, b.y, b.width, b.height, pose.x, pose.y, pose.width, pose.height);
  return transformPath(path, m);
}

/**
 * Bake `pose` into `path`'s coordinates so the returned path is positioned
 * in world space. Returns a fresh `Path` instance; never mutates inputs.
 */
export function pathInWorld(path: Path, pose: PathInWorldPose): Path {
  // Step 1: project into the pose's local frame (translate; rebase rect dims).
  // Shares `pathInPoseFrame` with the renderer so world geometry never diverges
  // from what's painted — notably for resized rects (pose dims, not path dims).
  const local = pathInPoseFrame(path, pose);

  // Step 2: apply the pose's rotation about its AABB center, if any. The ≈0
  // gate + AABB-center pivot come from `poseRotationOf` (the shared rotation
  // convention); the rotation itself composes on the kernel — `transformPath`
  // handles the rect->polygon promotion and bezier control-point rotation,
  // identically to the bespoke `rotatePathAround` it replaces.
  const r = poseRotationOf(pose);
  if (!r) return local;
  return transformPath(local, rotateAboutPoint(r.cx, r.cy, r.rotation)) as PolygonPath;
}

/**
 * Inverse of `pathInWorld` for an editable polygon: given a polygon edited in
 * **world** space and the node's current pose, produce the unrotated stored
 * path plus an updated pose. Inverse-rotates about the pose's AABB center (so
 * the stored path stays unrotated and the pose's `rotation` is preserved),
 * then realigns the result to its own AABB origin and updates the pose's AABB
 * fields. The invariant `pathInWorld(result.path, result.pose) === worldPath`
 * holds (up to the AABB-center pivot), so anchor edits round-trip.
 *
 * Generic in the pose type so consumer-defined pose fields (including
 * `rotation`) survive the round-trip. Used by both the edit-commit seam and the
 * live anchor-drag preview so they share one world→local inversion.
 */
export function worldEditToStorage<P extends PathInWorldPose>(
  pose: P,
  worldPath: PolygonPath,
): { pose: P; path: PolygonPath } {
  const r = poseRotationOf(pose);
  const unrotated = r ? rotatePathAround(worldPath, r.cx, r.cy, -r.rotation) : worldPath;
  const bounds = boundsOfPath(unrotated);
  const aligned = translatePath(unrotated, -bounds.x, -bounds.y) as PolygonPath;
  return {
    pose: { ...pose, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    path: aligned,
  };
}
