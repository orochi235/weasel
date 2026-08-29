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
 * A `Path`'s contours carry no outer/hole marking of their own: which
 * regions are solid follows from nesting plus the path's `fillRule`. This
 * module resolves that into the outer + holes grouping the clipper needs.
 *
 * Bezier inputs are flattened via the existing `flatten.ts` utility — v1
 * is straight-line only. Open contours are implicitly closed because
 * boolean ops are defined on closed regions; polylines have zero area
 * and would otherwise be silently dropped.
 */
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, type Path, type PathFillRule, type PolygonPath } from './types';
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
      default:
        throw new Error(`pathToMultiPolygon: unknown command ${cmd}`);
    }
  }
  finalizeCurrent();

  if (rings.length === 0) return [];
  return groupRings(rings, path.fillRule);
}

/** Shoelace area of a closed ring. Sign gives the winding direction. */
function ringSignedArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a * 0.5;
}

type Box = [number, number, number, number];

function ringBox(ring: Ring): Box {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Even-odd ray cast; used only to decide ring nesting, never to fill. */
function pointInRing(ring: Ring, px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[i + 1];
    if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Nesting test by majority vote over three sample vertices — a single sample
 * gives the wrong answer whenever it lands exactly on the outer ring.
 */
function ringContains(outer: Ring, outerBox: Box, inner: Ring, innerBox: Box): boolean {
  if (innerBox[0] < outerBox[0] || innerBox[1] < outerBox[1]
    || innerBox[2] > outerBox[2] || innerBox[3] > outerBox[3]) return false;
  const n = inner.length - 1;
  let votes = 0;
  for (const k of [0, Math.floor(n / 3), Math.floor((2 * n) / 3)]) {
    if (pointInRing(outer, inner[k][0], inner[k][1])) votes++;
  }
  return votes >= 2;
}

/**
 * Resolve rings into `polygon-clipping` polygons (outer ring first, hole
 * rings after) by nesting depth and `fillRule`. Rings that bound no boundary
 * of the filled region — a same-winding ring nested inside a nonzero fill —
 * are dropped; they contribute nothing to the area.
 */
function groupRings(rings: Ring[], fillRule: PathFillRule): MultiPolygon {
  const n = rings.length;
  if (n === 1) return [[rings[0]]];

  const boxes = rings.map(ringBox);
  const orient = rings.map((r) => (ringSignedArea(r) >= 0 ? 1 : -1));
  const parent = new Array<number>(n).fill(-1);
  const children: number[][] = rings.map(() => []);

  for (let i = 0; i < n; i++) {
    let best = -1;
    let bestArea = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (!ringContains(rings[j], boxes[j], rings[i], boxes[i])) continue;
      const area = (boxes[j][2] - boxes[j][0]) * (boxes[j][3] - boxes[j][1]);
      if (area < bestArea) { bestArea = area; best = j; }
    }
    parent[i] = best;
  }
  for (let i = 0; i < n; i++) if (parent[i] >= 0) children[parent[i]].push(i);

  const filled = new Array<boolean>(n);
  for (let i = 0; i < n; i++) {
    let depth = 0;
    let winding = 0;
    for (let a: number = i; a >= 0; a = parent[a]) {
      winding += orient[a];
      if (a !== i) depth++;
    }
    filled[i] = fillRule === 'evenodd' ? depth % 2 === 0 : winding !== 0;
  }

  const out: MultiPolygon = [];
  for (let i = 0; i < n; i++) {
    if (!filled[i]) continue;
    if (parent[i] >= 0 && filled[parent[i]]) continue;
    const polygon: Polygon = [rings[i]];
    const queue = [...children[i]];
    while (queue.length > 0) {
      const c = queue.pop() as number;
      // An unfilled child bounds a hole; a filled one merges into this
      // region, so its own children are what may punch holes in it.
      if (filled[c]) queue.push(...children[c]);
      else polygon.push(rings[c]);
    }
    out.push(polygon);
  }
  return out;
}

/** Convert a `MultiPolygon` to a `PolygonPath` with `fillRule: 'nonzero'`. */
export function multiPolygonToPath(mp: MultiPolygon): PolygonPath {
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
