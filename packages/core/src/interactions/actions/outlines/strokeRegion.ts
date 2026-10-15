import { strokeToPath } from '@weasel-js/stroke';
import type { Affine, Path, PolygonPath, Scale2 } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';

/** How Outline Stroke and a Boolean operation counting strokes measure one. */
export interface StrokeRegionOptions {
  /** The view scale a `{ px }` width resolves against: one number, or the
   *  view's own scale per axis. Default 1. */
  scale?: number | Scale2;
  /** Flatness tolerance for curves, in the units of the frame the stroke is
   *  drawn in. */
  flattenTolerance?: number;
}

/**
 * The region `stroke` covers along the world-space `path`, outlined in the
 * frame the canvas draws it in: the screen for a `{ px }` width, so a view
 * that scales its axes apart thins it on one of them, and otherwise `frame`,
 * the node's own (`poseFrameOf`, to world), which skews and stretches the
 * stroke with the node.
 */
export function strokeRegion(
  path: Path,
  stroke: Stroke,
  frame: Affine | null | undefined,
  { scale = 1, flattenTolerance }: StrokeRegionOptions = {},
): PolygonPath {
  const tolerance = flattenTolerance === undefined ? {} : { flattenTolerance };
  const sx = typeof scale === 'number' ? scale : scale.x;
  const sy = typeof scale === 'number' ? scale : scale.y;
  const mean = Math.sqrt(Math.abs(sx * sy));
  if (typeof stroke.width === 'object') {
    if (Math.abs(sx) === Math.abs(sy)) return strokeToPath(path, stroke, { ...tolerance, scale: mean });
    return strokeToPath(path, stroke, { ...tolerance, frame: [1 / sx, 0, 0, 1 / sy, 0, 0] });
  }
  return strokeToPath(path, stroke, { ...tolerance, scale: mean, ...(frame ? { frame } : {}) });
}
