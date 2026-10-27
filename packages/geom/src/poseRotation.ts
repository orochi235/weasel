/**
 * The kit's single encoding of the pose-rotation convention: "rotate about the
 * pose's unrotated AABB center by `pose.rotation` (radians)."
 *
 * A pose may also carry a `transform` inside the rotation. `poseFrameOf`
 * (`./poseFrame`) composes the two, and is what a reader that draws, bounds,
 * or picks the node wants; this module is the angle and pivot alone.
 */
import { forEachSegment, pathCommandCoordCount, PATH_L, PATH_M, PATH_Z } from './commands';
import type { Path, PolygonPath } from './path';
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
 * center.
 */
export function poseRotationOf(pose: unknown): PoseRotation | null {
  const p = pose as Partial<{ x: number; y: number; width: number; height: number; rotation: number }>;
  if (p.rotation && p.x != null && p.y != null && p.width != null && p.height != null) {
    return { cx: p.x + p.width / 2, cy: p.y + p.height / 2, rotation: p.rotation };
  }
  return null;
}

/**
 * Rotate every coordinate of `path` about `(cx, cy)` by `rotation` radians.
 * A `rect` promotes to a four-corner polygon (axis-aligned rects can't encode
 * rotation). Returns a fresh `PolygonPath`; never mutates the input.
 */
export function rotatePathAround(path: Path, cx: number, cy: number, rotation: number): PolygonPath {
  if (path.kind === 'rect') {
    return rotateRectCorners(path.x, path.y, path.width, path.height, cx, cy, rotation);
  }
  return rotatePolygon(path, cx, cy, rotation);
}

function rotatePolygon(path: PolygonPath, cx: number, cy: number, rotation: number): PolygonPath {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  if (path.origin) {
    return transformPath(path, [cos, sin, -sin, cos, cx - cx * cos + cy * sin, cy - cx * sin - cy * cos]) as PolygonPath;
  }
  const { commands, coords } = path;
  const next = new Float32Array(coords.length);
  forEachSegment(commands, coords, (cmd, ci) => {
    for (let k = 0, len = pathCommandCoordCount(cmd); k < len; k += 2) {
      const dx = coords[ci + k] - cx;
      const dy = coords[ci + k + 1] - cy;
      next[ci + k] = cx + dx * cos - dy * sin;
      next[ci + k + 1] = cy + dx * sin + dy * cos;
    }
  });
  return { ...path, coords: next };
}

function rotateRectCorners(
  x: number, y: number, w: number, h: number,
  cx: number, cy: number, rotation: number,
): PolygonPath {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rotate = (px: number, py: number): [number, number] => {
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  };
  const [x0, y0] = rotate(x, y);
  const [x1, y1] = rotate(x + w, y);
  const [x2, y2] = rotate(x + w, y + h);
  const [x3, y3] = rotate(x, y + h);
  const commands = new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]);
  const coords = new Float32Array([x0, y0, x1, y1, x2, y2, x3, y3]);
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}
