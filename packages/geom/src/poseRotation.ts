/**
 * The kit's single encoding of the pose-rotation convention: "rotate about the
 * pose's unrotated AABB center by `pose.rotation` (radians)."
 *
 * A pose may also carry a `transform` inside the rotation. `poseFrameOf`
 * (`./poseFrame`) composes the two, and is what a reader that draws, bounds,
 * or picks the node wants; this module is the angle and pivot alone.
 */
import type { Affine } from './affine';
import type { Path, PolygonPath, RectPath } from './path';
import { PathBuilder } from './paths/builder';
import { transformPath } from './paths/transformPath';

/** Pivot (`cx`, `cy`) and angle resolved from a pose's rotation convention. */
export interface PoseRotation {
  cx: number;
  cy: number;
  rotation: number;
}

/**
 * Resolve a pose's rotation transform, or `null` when the pose carries no
 * effective rotation. Non-null requires a nonzero `rotation` **and** all four
 * AABB fields (`x`, `y`, `width`, `height`) — the pivot is the unrotated AABB
 * center. A `null` or `undefined` pose carries none.
 */
export function poseRotationOf(pose: unknown): PoseRotation | null {
  const p = pose as Partial<{ x: number; y: number; width: number; height: number; rotation: number }> | null | undefined;
  if (p?.rotation && p.x != null && p.y != null && p.width != null && p.height != null) {
    return { cx: p.x + p.width / 2, cy: p.y + p.height / 2, rotation: p.rotation };
  }
  return null;
}

/**
 * Rotate every coordinate of `path` about `(cx, cy)` by `rotation` radians.
 * A `rect` promotes to a four-corner polygon (axis-aligned rects can't encode
 * rotation). Returns a fresh `PolygonPath`; never mutates the input. A result
 * landing far from 0 is measured from an origin, as `transformPath` gives one,
 * so the rotation's doubles survive the float32 coords.
 */
export function rotatePathAbout(path: Path, cx: number, cy: number, rotation: number): PolygonPath {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const about: Affine = [cos, sin, -sin, cos, cx - cx * cos + cy * sin, cy - cx * sin - cy * cos];
  return transformPath(path.kind === 'rect' ? rectCorners(path) : path, about) as PolygonPath;
}

/** A rect's four corners as a closed polygon, measured from an origin where they lie far out. */
function rectCorners({ x, y, width, height }: RectPath): PolygonPath {
  return new PathBuilder().autoOrigin()
    .moveTo(x, y)
    .lineTo(x + width, y)
    .lineTo(x + width, y + height)
    .lineTo(x, y + height)
    .close()
    .build();
}
