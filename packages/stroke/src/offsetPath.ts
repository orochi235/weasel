import {
  anchorsToPath, offsetCornerTraces, pathToAnchors, resolveCorners, restoreCorners, simplifyPath,
  type Path, type PolygonPath,
} from '@weasel-js/geom';
import { pathSubtract, pathUnion } from '@weasel-js/geom/booleans';
import { strokeToPath } from './strokeToPath';

/** Options for {@link offsetPath}. */
export interface OffsetPathOptions {
  /** How the offset outline turns a corner. Default `'miter'`. */
  join?: 'miter' | 'round' | 'bevel';
  /** Past this ratio of miter length to distance a miter corner is beveled.
   *  Default 4. */
  miterLimit?: number;
  /** How closely curves are followed, in the path's units. Default 0.1. */
  tolerance?: number;
  /** Refit the outline's flattened curves as cubics (`simplifyPath` at
   *  `tolerance`). Default true; false leaves a polygon. */
  refit?: boolean;
}

/**
 * The outline of the region `path` fills, grown by `distance` (shrunk by a
 * negative one), as a path to fill. Every subpath counts as closed. The
 * outline is where a stroke of twice `distance` centered on the path has its
 * outer (or inner) edge, so it takes that stroke's joins; overlaps resolve
 * the way a union does, and a region shrunk past its own width is gone.
 * Returns an empty path when nothing is left.
 */
export function offsetPath(path: Path, distance: number, opts: OffsetPathOptions = {}): PolygonPath {
  if (distance === 0) return closedRegion(path);
  const region = closedRegion(resolveCorners(path));
  const tolerance = opts.tolerance ?? 0.1;
  const band = strokeToPath(region, {
    width: Math.abs(distance) * 2,
    join: opts.join ?? 'miter',
    miterLimit: opts.miterLimit ?? 4,
  }, { flattenTolerance: tolerance });
  const cut = distance > 0 ? pathUnion(region, band) : pathSubtract(region, band);
  const corners = offsetCornerTraces(path, distance);
  // Tried before the refit, which can move a cut's ends off its anchors, and
  // after it, which can clear what the union left beside the cut.
  const grown = restoreCorners(cut, corners, tolerance);
  if (opts.refit === false || grown.commands.length === 0) return grown;
  return restoreCorners(simplifyPath(grown, tolerance), corners, tolerance);
}

/** `path` with every subpath closed. */
function closedRegion(path: Path): PolygonPath {
  if (path.kind === 'rect') {
    const { x, y, width: w, height: h } = path;
    return anchorsToPath([[{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]], [true]);
  }
  const { anchors, closed } = pathToAnchors(path);
  if (closed.every(Boolean)) return path;
  return anchorsToPath(anchors, closed.map(() => true), path);
}
