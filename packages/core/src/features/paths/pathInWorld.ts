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

import {
  applyToPoint,
  boxToBox,
  boundsOfPath,
  type Path,
  type PolygonPath,
  translatePath,
  transformPath,
} from '@weasel-js/geom';
import { poseFrameInverseOf, poseFrameOf, type PoseLinear } from '@weasel-js/geom';

/** Subset of pose fields this helper consumes. Matches the kit's auto-rotate
 *  convention (`SceneCanvas.defaultDrawOne`): `x/y/width/height` define an
 *  AABB whose unrotated center is the rotation pivot. */
export interface PathInWorldPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  transform?: PoseLinear;
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

  // Step 2: apply the pose's frame about its AABB center, if any: its
  // rotation and its `transform`, composed by `poseFrameOf` as the renderer's
  // wrap composes them. `transformPath` handles the rect->polygon promotion
  // and bezier control points.
  const frame = poseFrameOf(pose);
  if (!frame) return local;
  return transformPath(local, frame) as PolygonPath;
}

/**
 * Inverse of `pathInWorld` for a path in **world** space: the stored path
 * in the pose's own frame plus the pose that draws it there. Takes the path
 * back through the pose's frame (`poseFrameOf`), so the pose's `rotation`
 * and `transform` are preserved, then fits the pose's AABB fields to the
 * result. The new box's center is placed where the old frame carries it,
 * since the pivot moves with the box: `pathInWorld(result.path, result.pose)`
 * reproduces `worldPath` whether or not its bounds changed.
 *
 * Generic in the pose type so consumer-defined pose fields (including
 * `rotation`) survive the round-trip. Used by the anchor-edit commit, its
 * live preview, and the default slice dep.
 */
export function worldEditToStorage<P extends PathInWorldPose>(
  pose: P,
  worldPath: PolygonPath,
): { pose: P; path: PolygonPath };
export function worldEditToStorage<P extends PathInWorldPose>(pose: P, worldPath: Path): { pose: P; path: Path };
export function worldEditToStorage<P extends PathInWorldPose>(
  pose: P,
  worldPath: Path,
): { pose: P; path: Path } {
  // A singular `transform` has no way back, and the path is stored as drawn.
  const back = poseFrameInverseOf(pose);
  const frame = back && poseFrameOf(pose);
  const unrotated = back ? transformPath(worldPath, back) : worldPath;
  const b = boundsOfPath(unrotated);
  const aligned = translatePath(unrotated, -b.x, -b.y);
  let x = b.x, y = b.y;
  if (frame) {
    const [cx, cy] = applyToPoint(frame, b.x + b.width / 2, b.y + b.height / 2);
    x = cx - b.width / 2;
    y = cy - b.height / 2;
  }
  return {
    pose: { ...pose, x, y, width: b.width, height: b.height },
    path: aligned,
  };
}
