/**
 * A path flattened into runs of points, sorted by whether each subpath
 * encloses area: what the hit tests in `pathHitTest.ts` walk.
 */
import { forEachSegment, PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from './commands';
import { DEFAULT_FLATTEN_TOLERANCE, flattenCubic, flattenQuadratic } from './flatten';
import { fillsOpenSubpaths } from './openFill';
import type { PolygonPath } from './path';
import { resolveCorners } from './paths/corners';
import { worldCoords } from './paths/pathOrigin';

/**
 * `path` flattened to interleaved `[x, y, …]` runs, sorted by whether each
 * subpath encloses area. A `Z` closing fewer than three points yields an open
 * run, as does any subpath a `Z` never ends. The closing edge of a closed run
 * back to its first vertex is implicit. Corner shapes are walked expanded.
 */
export function flatSubpaths(
  path: PolygonPath,
  tolerance: number,
): { closed: number[][]; open: number[][] } {
  const drawn = resolveCorners(path);
  const { commands } = drawn;
  const coords = worldCoords(drawn);
  const closed: number[][] = [];
  const open: number[][] = [];
  let sub: number[] = [];

  forEachSegment(commands, coords, (cmd, ci, curX, curY, _i, opensSubpath) => {
    if (opensSubpath) sub = [curX, curY];
    switch (cmd) {
      case PATH_M:
        if (sub.length >= 2) open.push(sub);
        sub = [coords[ci], coords[ci + 1]];
        break;
      case PATH_L:
        sub.push(coords[ci], coords[ci + 1]);
        break;
      case PATH_C:
        flattenCubic(
          curX, curY,
          coords[ci], coords[ci + 1],
          coords[ci + 2], coords[ci + 3],
          coords[ci + 4], coords[ci + 5],
          tolerance, sub,
        );
        break;
      case PATH_Q:
        flattenQuadratic(
          curX, curY,
          coords[ci], coords[ci + 1],
          coords[ci + 2], coords[ci + 3],
          tolerance, sub,
        );
        break;
      case PATH_Z:
        if (sub.length >= 6) closed.push(sub);
        else if (sub.length >= 2) open.push(sub);
        sub = [];
        break;
      default:
        throw new Error(`pathHitTest: unknown command ${cmd}`);
    }
  });
  if (sub.length >= 2) open.push(sub);
  return { closed, open };
}

/** `flatSubpaths`, with each open run a fill closes moved among the closed. */
export function regionSubpaths(
  path: PolygonPath,
  opts: { tolerance?: number },
): { closed: number[][]; open: number[][] } {
  const flat = flatSubpaths(path, opts.tolerance ?? DEFAULT_FLATTEN_TOLERANCE);
  if (!fillsOpenSubpaths(path)) return flat;
  return {
    closed: [...flat.closed, ...flat.open.filter((sub) => sub.length >= 6)],
    open: flat.open.filter((sub) => sub.length < 6),
  };
}

export function closedSubpaths(path: PolygonPath, opts: { tolerance?: number }): number[][] {
  return regionSubpaths(path, opts).closed;
}
