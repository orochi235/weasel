/**
 * Adapter between geom's path input shape and `polygon-clipping`'s
 * `MultiPolygon` format. Kept in a dedicated module so the dep is one
 * import away from being swappable. Ported from
 * `src/features/paths/booleans.adapter.ts`.
 *
 * `polygon-clipping` expects:
 *   MultiPolygon = Polygon[]
 *   Polygon      = Ring[]   (first ring outer, subsequent rings holes)
 *   Ring         = [x, y][] (closed — first vertex repeated as last)
 *
 * Bezier inputs are flattened (cubic; quadratics are degree-elevated to cubic
 * first) — v1 is straight-line only. Open contours are implicitly closed
 * because boolean ops are defined on closed regions; polylines have zero area
 * and would otherwise be silently dropped.
 *
 * The `[x,y][]` nested-array form here is the one place geom's flat-everywhere
 * rule is suspended — it is the third-party clipper's required API.
 */
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z } from '../commands';
import { flattenCubic, elevateQuadraticToCubic } from '../curve';

/** Minimal path input: a rect or a polygon command stream. geom does not
 *  import @weasel-js/core's `Path`; the kit maps `Path` onto this shape. */
export type GeomPath =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'polygon'; commands: ArrayLike<number>; coords: ArrayLike<number>; fillRule?: 'nonzero' | 'evenodd' };

const DEFAULT_FLATTEN_TOLERANCE = 0.5;

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

/** Polygon result shape emitted by `multiPolygonToPath`. */
export type GeomPolygonPath = { kind: 'polygon'; commands: Uint8Array; coords: Float32Array; fillRule: 'nonzero' };

/** Convert a `GeomPath` to a `MultiPolygon` suitable for `polygon-clipping`. */
export function pathToMultiPolygon(
  path: GeomPath,
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
        const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(cx, cy, x1, y1, x2, y2);
        const out: number[] = [];
        flattenCubic(cx, cy, c1x, c1y, c2x, c2y, x2, y2, tolerance, out);
        if (current) for (let k = 0; k < out.length; k += 2) current.push([out[k], out[k + 1]]);
        cx = x2; cy = y2;
        ci += 4;
        break;
      }
      case PATH_Z: {
        finalizeCurrent();
        break;
      }
      default:
        throw new Error(`pathToMultiPolygon: unknown command ${cmd}`);
    }
  }
  finalizeCurrent();

  if (rings.length === 0) return [];
  return nestRings(rings, path.fillRule ?? 'nonzero');
}

/** Twice the signed area of a closed ring. Positive and negative encode the
 *  two winding directions; the factor of two is irrelevant to both uses
 *  (sign, and comparison against zero). */
function doubleSignedArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a;
}

/** Even-odd ray cast of `(px, py)` against a closed ring. */
function pointInRing(ring: Ring, px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2, n = ring.length - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Group a path's rings into `polygon-clipping` polygons — one filled outer
 * ring followed by the hole rings immediately inside it.
 *
 * Without this a path's own holes are lost: separate polygons in a
 * MultiPolygon are unioned, so a donut arrives at the clipper as a solid disc.
 *
 * Containment is probed from the midpoint of each ring's first edge rather
 * than from a vertex — a shared vertex between a hole and its container is
 * common, and a probe point sitting exactly on the tested boundary answers
 * arbitrarily.
 */
function nestRings(rings: Ring[], fillRule: 'nonzero' | 'evenodd'): MultiPolygon {
  const n = rings.length;
  if (n === 1) return [[rings[0]]];

  const areas = rings.map(doubleSignedArea);
  const probes = rings.map((r): Pair => [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2]);

  // containers[i] — indices of the rings that enclose ring i.
  const containers: number[][] = rings.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && pointInRing(rings[j], probes[i][0], probes[i][1])) containers[i].push(j);
    }
  }

  const filled = rings.map((_, i) => {
    if (fillRule === 'evenodd') return containers[i].length % 2 === 0;
    let winding = Math.sign(areas[i]);
    for (const j of containers[i]) winding += Math.sign(areas[j]);
    return winding !== 0;
  });

  const out: MultiPolygon = [];
  for (let i = 0; i < n; i++) {
    if (!filled[i]) continue;
    const poly: Polygon = [rings[i]];
    for (let k = 0; k < n; k++) {
      if (filled[k] || containers[k].length !== containers[i].length + 1) continue;
      if (containers[k].includes(i)) poly.push(rings[k]);
    }
    out.push(poly);
  }
  return out;
}

/** Convert a `MultiPolygon` to a polygon path with `fillRule: 'nonzero'`. */
export function multiPolygonToPath(mp: MultiPolygon): GeomPolygonPath {
  // First pass: count total commands and coord floats.
  let nCmds = 0;
  let nCoords = 0;
  for (const poly of mp) {
    for (const ring of poly) {
      if (ring.length < 4) continue; // 3 unique + 1 closing minimum
      // Drop the repeated closing vertex; emit M + (n-2) L + Z.
      const unique = ring.length - 1;
      nCmds += 1 + (unique - 1) + 1; // M + L*(unique-1) + Z
      nCoords += unique * 2;
    }
  }
  const commands = new Uint8Array(nCmds);
  const coords = new Float32Array(nCoords);
  let ci = 0;
  let pi = 0;
  for (const poly of mp) {
    for (const ring of poly) {
      if (ring.length < 4) continue;
      const unique = ring.length - 1;
      // M (first vertex)
      commands[ci++] = PATH_M;
      coords[pi++] = ring[0][0];
      coords[pi++] = ring[0][1];
      // L for vertices 1..unique-1
      for (let k = 1; k < unique; k++) {
        commands[ci++] = PATH_L;
        coords[pi++] = ring[k][0];
        coords[pi++] = ring[k][1];
      }
      // Z
      commands[ci++] = PATH_Z;
    }
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}
