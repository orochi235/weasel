import earcut from 'earcut';
import {
  type Path,
  type PolygonPath,
  type RectPath,
  PATH_M,
  PATH_L,
  PATH_Z,
  PATH_C,
  PATH_Q,
  DEFAULT_FLATTEN_TOLERANCE,
  flattenCubic,
  flattenQuadratic,
} from '@orochi235/weasel';
import type { Mesh } from './mesh';

export interface TessellateOptions {
  /** Flatness tolerance for bezier subdivision in path-local units. */
  flattenTolerance?: number;
}

export function tessellate(path: Path, opts: TessellateOptions = {}): Mesh {
  if (path.kind === 'rect') return tessellateRect(path);
  return tessellatePolygon(path, opts);
}

function tessellateRect(p: RectPath): Mesh {
  const { x, y, width: w, height: h } = p;
  return {
    vertices: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

interface FlattenedContours {
  /** Interleaved x,y for all contours concatenated. */
  coords: number[];
  /** Vertex (not coord) index where each contour starts. First contour starts at 0. */
  contourStarts: number[];
}

function flattenPolygon(p: PolygonPath, tolerance: number): FlattenedContours {
  const { commands, coords } = p;
  const out: number[] = [];
  const contourStarts: number[] = [];
  let coordIdx = 0;
  let prevX = 0;
  let prevY = 0;

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        contourStarts.push(out.length / 2);
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      case PATH_Q: {
        const cx = coords[coordIdx];
        const cy = coords[coordIdx + 1];
        const ex = coords[coordIdx + 2];
        const ey = coords[coordIdx + 3];
        flattenQuadratic(prevX, prevY, cx, cy, ex, ey, tolerance, out);
        prevX = ex;
        prevY = ey;
        coordIdx += 4;
        break;
      }
      case PATH_C: {
        const c1x = coords[coordIdx];
        const c1y = coords[coordIdx + 1];
        const c2x = coords[coordIdx + 2];
        const c2y = coords[coordIdx + 3];
        const ex = coords[coordIdx + 4];
        const ey = coords[coordIdx + 5];
        flattenCubic(prevX, prevY, c1x, c1y, c2x, c2y, ex, ey, tolerance, out);
        prevX = ex;
        prevY = ey;
        coordIdx += 6;
        break;
      }
      case PATH_Z: {
        break;
      }
      default:
        throw new Error(`tessellate: unknown command code ${cmd}`);
    }
  }

  return { coords: out, contourStarts };
}

function tessellatePolygon(p: PolygonPath, opts: TessellateOptions): Mesh {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { coords, contourStarts } = flattenPolygon(p, tolerance);

  if (p.fillRule === 'evenodd') {
    return tessellateEvenodd(coords, contourStarts);
  }

  // nonzero compound-path tessellation:
  //   - CCW contours (signed area > 0) are positive (filled).
  //   - CW contours (signed area < 0) are holes; each is grouped with
  //     the smallest positive contour that contains its first vertex.
  //   - Each (positive, [its holes]) group is earcut'd independently;
  //     triangles concatenated.
  // The previous implementation passed every subsequent contour as a
  // hole regardless of winding, which broke any path with multiple
  // disjoint positive contours (e.g. a duck with body + head + beak,
  // a hamburglar with hat brim + crown + cape).
  const totalVerts = coords.length / 2;
  const contourEnd = (i: number): number =>
    i + 1 < contourStarts.length ? contourStarts[i + 1] : totalVerts;

  const areas: number[] = contourStarts.map((s, i) => signedArea(coords, s, contourEnd(i)));

  const positives: number[] = [];
  const negatives: number[] = [];
  for (let i = 0; i < contourStarts.length; i++) {
    if (areas[i] > 0) positives.push(i);
    else if (areas[i] < 0) negatives.push(i);
  }

  if (positives.length <= 1) {
    // Single positive (or all-negative degenerate); preserve previous
    // earcut-with-holes behavior on the whole vertex buffer.
    const holeIndices = contourStarts.slice(1);
    const tri = earcut(coords, holeIndices.length > 0 ? holeIndices : undefined);
    return { vertices: new Float32Array(coords), indices: new Uint32Array(tri) };
  }

  // Multiple positives: group each negative with its containing positive
  // (smallest-area positive whose polygon contains the negative's first vertex).
  const holesByPositive = new Map<number, number[]>();
  for (const n of negatives) {
    const px = coords[contourStarts[n] * 2];
    const py = coords[contourStarts[n] * 2 + 1];
    let bestPos = -1;
    let bestArea = Infinity;
    for (const pos of positives) {
      if (areas[pos] < bestArea && pointInContour(coords, contourStarts[pos], contourEnd(pos), px, py)) {
        bestArea = areas[pos];
        bestPos = pos;
      }
    }
    if (bestPos >= 0) {
      const arr = holesByPositive.get(bestPos) ?? [];
      arr.push(n);
      holesByPositive.set(bestPos, arr);
    }
  }

  // Build (coords, indices) by iterating positives and appending each
  // (positive + its holes) group as an independent earcut run.
  const finalCoords: number[] = [];
  const finalIndices: number[] = [];
  for (const pos of positives) {
    const holes = holesByPositive.get(pos) ?? [];
    const offset = finalCoords.length / 2;
    const groupCoords: number[] = [];
    const groupStarts: number[] = [0];
    for (let i = contourStarts[pos] * 2; i < contourEnd(pos) * 2; i++) groupCoords.push(coords[i]);
    for (const h of holes) {
      groupStarts.push(groupCoords.length / 2);
      for (let i = contourStarts[h] * 2; i < contourEnd(h) * 2; i++) groupCoords.push(coords[i]);
    }
    const tri = earcut(groupCoords, groupStarts.length > 1 ? groupStarts.slice(1) : undefined);
    for (const v of groupCoords) finalCoords.push(v);
    for (const idx of tri) finalIndices.push(idx + offset);
  }

  return {
    vertices: new Float32Array(finalCoords),
    indices: new Uint32Array(finalIndices),
  };
}

function signedArea(coords: number[], start: number, end: number): number {
  let a = 0;
  for (let i = start; i < end; i++) {
    const j = i + 1 === end ? start : i + 1;
    a += coords[i * 2] * coords[j * 2 + 1] - coords[j * 2] * coords[i * 2 + 1];
  }
  return a * 0.5;
}

function pointInContour(coords: number[], start: number, end: number, x: number, y: number): boolean {
  let inside = false;
  for (let i = start, j = end - 1; i < end; j = i++) {
    const xi = coords[i * 2], yi = coords[i * 2 + 1];
    const xj = coords[j * 2], yj = coords[j * 2 + 1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function tessellateEvenodd(coords: number[], contourStarts: number[]): Mesh {
  const indices: number[] = [];
  const totalVerts = coords.length / 2;
  for (let c = 0; c < contourStarts.length; c++) {
    const start = contourStarts[c];
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : totalVerts;
    // Naive fan: pivot = start, triangles (start, i, i+1) for i in [start+1, end-1).
    for (let i = start + 1; i < end - 1; i++) {
      indices.push(start, i, i + 1);
    }
  }
  return {
    vertices: new Float32Array(coords),
    indices: new Uint32Array(indices),
    requiresStencil: true,
  };
}
