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
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type Path, type PolygonPath } from './types';
import { translatePath } from './transform';

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

  // Step 2: apply pose.rotation about the AABB center, if any.
  const rotation = pose.rotation ?? 0;
  if (rotation === 0) return translated;

  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;

  // Rect + rotation -> promote to a polygon by baking the four corners.
  if (translated.kind === 'rect') {
    return rotateRectCorners(translated.x, translated.y, translated.width, translated.height, cx, cy, rotation);
  }
  return rotatePolygon(translated, cx, cy, rotation);
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
