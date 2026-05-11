/**
 * Adapter between weasel's `Path` shape and `polygon-clipping`'s
 * `MultiPolygon` format. Kept in a dedicated module so the dep is one
 * import away from being swappable.
 *
 * `polygon-clipping` expects:
 *   MultiPolygon = Polygon[]
 *   Polygon      = Ring[]   (first ring outer, subsequent rings holes)
 *   Ring         = [x, y][] (closed — first vertex repeated as last)
 *
 * Bezier inputs are flattened via the existing `flatten.ts` utility — v1
 * is straight-line only. Open contours are implicitly closed because
 * boolean ops are defined on closed regions; polylines have zero area
 * and would otherwise be silently dropped.
 */
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, type Path } from './types';
import { flattenCubic, flattenQuadratic, DEFAULT_FLATTEN_TOLERANCE } from './flatten';

/** A `[x, y]` 2-tuple. */
export type Pair = [number, number];
/** Closed ring (first vertex repeated as last). */
export type Ring = Pair[];
/** Polygon: one outer ring optionally followed by hole rings. */
export type Polygon = Ring[];
/** MultiPolygon: list of polygons (used for boolean op I/O). */
export type MultiPolygon = Polygon[];

export interface PathToMultiPolygonOptions {
  /** Flattening tolerance for bezier segments. Default: `DEFAULT_FLATTEN_TOLERANCE`. */
  tolerance?: number;
}

/** Convert a `Path` to a `MultiPolygon` suitable for `polygon-clipping`. */
export function pathToMultiPolygon(
  path: Path,
  opts: PathToMultiPolygonOptions = {},
): MultiPolygon {
  if (path.kind === 'rect') {
    const { x, y, width, height } = path;
    const ring: Ring = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
      [x, y],
    ];
    return [[ring]];
  }

  const tolerance = opts.tolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const rings: Ring[] = [];
  let current: Ring | null = null;
  let cx = 0, cy = 0;
  let ci = 0;
  const { commands, coords } = path;

  const finalizeCurrent = () => {
    if (!current || current.length === 0) return;
    // Close the ring by repeating the first vertex if not already closed.
    const first = current[0];
    const last = current[current.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      current.push([first[0], first[1]]);
    }
    if (current.length >= 4) rings.push(current); // 3 unique + 1 closing
    current = null;
  };

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M: {
        finalizeCurrent();
        cx = coords[ci]; cy = coords[ci + 1];
        current = [[cx, cy]];
        ci += 2;
        break;
      }
      case PATH_L: {
        cx = coords[ci]; cy = coords[ci + 1];
        if (current) current.push([cx, cy]);
        ci += 2;
        break;
      }
      case PATH_C: {
        const x1 = coords[ci], y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const x3 = coords[ci + 4], y3 = coords[ci + 5];
        const out: number[] = [];
        flattenCubic(cx, cy, x1, y1, x2, y2, x3, y3, tolerance, out);
        if (current) for (let k = 0; k < out.length; k += 2) current.push([out[k], out[k + 1]]);
        cx = x3; cy = y3;
        ci += 6;
        break;
      }
      case PATH_Q: {
        const x1 = coords[ci], y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const out: number[] = [];
        flattenQuadratic(cx, cy, x1, y1, x2, y2, tolerance, out);
        if (current) for (let k = 0; k < out.length; k += 2) current.push([out[k], out[k + 1]]);
        cx = x2; cy = y2;
        ci += 4;
        break;
      }
      case PATH_Z: {
        finalizeCurrent();
        break;
      }
    }
  }
  finalizeCurrent();

  if (rings.length === 0) return [];
  // v1: emit every ring as its own polygon. `polygon-clipping`'s engine
  // re-classifies winding internally during the op, so we don't need to
  // pre-sort outer/hole rings.
  return rings.map((r) => [r]);
}
