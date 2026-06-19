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

import { boundsOfPath } from './bounds';
import { type Path, type PolygonPath } from './types';
import { translatePath } from './transform';
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
 * Bake `pose` into `path`'s coordinates so the returned path is positioned
 * in world space. Returns a fresh `Path` instance; never mutates inputs.
 */
export function pathInWorld(path: Path, pose: PathInWorldPose): Path {
  // Step 1: translate so source AABB origin == pose origin.
  const b = boundsOfPath(path);
  const dx = pose.x - b.x;
  const dy = pose.y - b.y;
  const translated = (dx === 0 && dy === 0) ? path : translatePath(path, dx, dy);

  // Step 2: apply the pose's rotation about its AABB center, if any. The gate
  // and the rect->polygon promotion live in `poseRotationOf`/`rotatePathAround`
  // so every world seam shares one rotation implementation.
  const r = poseRotationOf(pose);
  if (!r) return translated;
  return rotatePathAround(translated, r.cx, r.cy, r.rotation);
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
