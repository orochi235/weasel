/**
 * Project a leaf path from its source frame into world coordinates given a
 * `{x, y, width, height, rotation?}` pose.
 *
 * RectPaths can't carry rotation as-is (they're axis-aligned by definition);
 * a non-zero `pose.rotation` on a rect promotes the result to a polygon so
 * the four corners are baked into world coords.
 */

import { applyToPoint, boxToBox } from '../affine';
import type { Path, PolygonPath } from '../path';
import { poseFrameInverseOf, poseFrameOf, type PoseLinear } from '../poseFrame';
import { boundsOfPath } from './bounds';
import { translatePath } from './transform';
import { transformPath } from './transformPath';

/** Subset of pose fields this helper consumes: `x/y/width/height` define an
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
 * Project a stored path into the pose's **local frame**: rebase its AABB onto
 * the pose box. It does NOT apply `pose.rotation`; `pathInWorld` composes
 * this with the rotation wrap.
 *
 * Rects rebase onto the pose's `width`/`height` because resize updates the pose,
 * not the stored `RectPath` — so the live size lives on the pose.
 */
export function pathInPoseFrame(path: Path, pose: PathInWorldPose): Path {
  if (path.kind === 'rect') {
    if (
      path.x === pose.x && path.y === pose.y
      && path.width === pose.width && path.height === pose.height
    ) return path;
    return { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height };
  }
  // Polygon: rebase the path's own AABB into the pose box. For geometry-in-data
  // nodes whose pose box was resized independently, it scales the contents to fill the box.
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
  // Shares `pathInPoseFrame` with the renderer so world geometry never diverges
  // from what's painted.
  const local = pathInPoseFrame(path, pose);

  // The pose's rotation and its `transform` about its AABB center, composed by
  // `poseFrameOf` as the renderer's wrap composes them.
  const frame = poseFrameOf(pose);
  if (!frame) return local;
  return transformPath(local, frame) as PolygonPath;
}

/**
 * Inverse of `pathInWorld` for a path in **world** space: the stored path
 * in the pose's own frame plus the pose that draws it there. The pose's
 * `rotation` and `transform` are preserved, and its AABB fields are fit to
 * the result. The new box's center is placed where the old frame carries it,
 * since the pivot moves with the box: `pathInWorld(result.path, result.pose)`
 * reproduces `worldPath` whether or not its bounds changed.
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
