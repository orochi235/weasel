/**
 * The kit's single encoding of the pose-rotation convention: "rotate about the
 * pose's unrotated AABB center by `pose.rotation` (radians)."
 *
 * Every consumer that needs to apply rotation — the render-tree wrap
 * (`canvas/poseRotation.ts`), the world coordinate bake (`pathInWorld`), the
 * silhouette/clip bake (`findShapeSilhouette`), the hit-test inverse
 * (`poseContainsRotated`), and selection chrome — derives its pivot + angle
 * from `poseRotationOf` rather than re-inlining the `if (rotation && x != null
 * …)` gate. If the convention ever changes (different pivot, a transform
 * field, etc.), it changes here.
 *
 * Lives in `features/paths` (the low layer) so both `features` and `canvas`
 * can share it without `features` importing `canvas`.
 */
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type Path, type PolygonPath } from './types';

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
 * center. Poses missing any AABB field (e.g. a bare polygon pose) or with
 * zero/absent rotation return `null`, so callers can treat `null` as "draw /
 * hit / clip in the local frame, no rotation step."
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
 * rotation); a polygon keeps its command list and rotates each coord. Returns
 * a fresh `PolygonPath`; never mutates the input. This is the coordinate-baking
 * companion to `poseRotationOf` — `pathInWorld` and `findShapeSilhouette` both
 * apply it so they share one rotation implementation.
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
  const { commands, coords } = path;
  const next = new Float32Array(coords.length);
  let ci = 0;
  for (let i = 0; i < commands.length; i++) {
    const len = COORD_COUNT[commands[i]];
    for (let k = 0; k < len; k += 2) {
      const dx = coords[ci + k] - cx;
      const dy = coords[ci + k + 1] - cy;
      next[ci + k] = cx + dx * cos - dy * sin;
      next[ci + k + 1] = cy + dx * sin + dy * cos;
    }
    ci += len;
  }
  return { kind: 'polygon', commands: path.commands, coords: next, fillRule: path.fillRule };
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
  // M, L, L, L, Z
  const commands = new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]);
  const coords = new Float32Array([x0, y0, x1, y1, x2, y2, x3, y3]);
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

const COORD_COUNT: Readonly<Record<number, number>> = {
  [PATH_M]: 2,
  [PATH_L]: 2,
  [PATH_C]: 6,
  [PATH_Q]: 4,
  [PATH_Z]: 0,
};
