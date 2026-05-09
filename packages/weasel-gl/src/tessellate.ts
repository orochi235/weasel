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

  // nonzero: hole indices for earcut are every contour after the first.
  const holeIndices = contourStarts.slice(1);
  const indices = earcut(coords, holeIndices.length > 0 ? holeIndices : undefined);
  return {
    vertices: new Float32Array(coords),
    indices: new Uint32Array(indices),
  };
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
