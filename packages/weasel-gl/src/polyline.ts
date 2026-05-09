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

export interface Polyline {
  /** Interleaved x,y vertices (length = 2 × point count). */
  points: number[];
  /** Whether the contour was closed (ends with Z, or is a RectPath). */
  closed: boolean;
}

export interface ExtractOptions {
  flattenTolerance?: number;
}

export function extractPolylines(path: Path, opts: ExtractOptions = {}): Polyline[] {
  if (path.kind === 'rect') return [extractRect(path)];
  return extractPolygon(path, opts);
}

function extractRect(p: RectPath): Polyline {
  const { x, y, width: w, height: h } = p;
  return { points: [x, y, x + w, y, x + w, y + h, x, y + h], closed: true };
}

function extractPolygon(p: PolygonPath, opts: ExtractOptions): Polyline[] {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { commands, coords } = p;
  const out: Polyline[] = [];
  let current: Polyline | null = null;
  let coordIdx = 0;
  let prevX = 0;
  let prevY = 0;

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        current = { points: [], closed: false };
        out.push(current);
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        current.points.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        if (current) current.points.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      case PATH_Q: {
        const cx = coords[coordIdx], cy = coords[coordIdx + 1];
        const ex = coords[coordIdx + 2], ey = coords[coordIdx + 3];
        if (current) flattenQuadratic(prevX, prevY, cx, cy, ex, ey, tolerance, current.points);
        prevX = ex; prevY = ey;
        coordIdx += 4;
        break;
      }
      case PATH_C: {
        const c1x = coords[coordIdx], c1y = coords[coordIdx + 1];
        const c2x = coords[coordIdx + 2], c2y = coords[coordIdx + 3];
        const ex = coords[coordIdx + 4], ey = coords[coordIdx + 5];
        if (current) flattenCubic(prevX, prevY, c1x, c1y, c2x, c2y, ex, ey, tolerance, current.points);
        prevX = ex; prevY = ey;
        coordIdx += 6;
        break;
      }
      case PATH_Z: {
        if (current) current.closed = true;
        break;
      }
      default:
        throw new Error(`extractPolylines: unknown command code ${cmd}`);
    }
  }

  return out;
}
