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
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
} from '@orochi235/weasel';

export interface Polyline {
  /** Interleaved x,y vertices (length = 2 × point count). */
  points: number[];
  /** Whether the contour was closed (ends with Z, or is a RectPath). */
  closed: boolean;
  /** For each point, the previous anchor index. Anchor-aligned points set A === B. */
  anchorA?: Uint32Array;
  /** For each point, the next anchor index. */
  anchorB?: Uint32Array;
  /** For each point, the arc-length fraction along (A, B). 0 at anchor A; for anchor-aligned, set to 0. */
  anchorT?: Float32Array;
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
  return {
    points: [x, y, x + w, y, x + w, y + h, x, y + h],
    closed: true,
    anchorA: new Uint32Array([0, 1, 2, 3]),
    anchorB: new Uint32Array([0, 1, 2, 3]),
    anchorT: new Float32Array([0, 0, 0, 0]),
  };
}

function extractPolygon(p: PolygonPath, opts: ExtractOptions): Polyline[] {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { commands, coords } = p;
  const out: Polyline[] = [];
  // Anchors are numbered globally (across all contours) in command-stream order.
  let anchorCounter = 0;

  // Builders for the current polyline.
  let pts: number[] | null = null;
  let aA: number[] | null = null;
  let aB: number[] | null = null;
  let aT: number[] | null = null;
  let current: Polyline | null = null;

  let coordIdx = 0;
  let prevX = 0;
  let prevY = 0;
  let prevAnchor = -1;

  const beginContour = () => {
    pts = [];
    aA = [];
    aB = [];
    aT = [];
    current = { points: pts, closed: false };
    out.push(current);
  };

  const commit = () => {
    if (!current || !pts || !aA || !aB || !aT) return;
    current.anchorA = new Uint32Array(aA);
    current.anchorB = new Uint32Array(aB);
    current.anchorT = new Float32Array(aT);
  };

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        if (current) commit();
        beginContour();
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        pts!.push(prevX, prevY);
        aA!.push(anchorCounter);
        aB!.push(anchorCounter);
        aT!.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        pts!.push(prevX, prevY);
        aA!.push(anchorCounter);
        aB!.push(anchorCounter);
        aT!.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        coordIdx += 2;
        break;
      }
      case PATH_Q: {
        const cx = coords[coordIdx], cy = coords[coordIdx + 1];
        const ex = coords[coordIdx + 2], ey = coords[coordIdx + 3];
        const targetAnchor = anchorCounter;
        const segStart = pts!.length / 2;
        const arcAccum: number[] = [];
        const total = flattenQuadraticWithArcLen(prevX, prevY, cx, cy, ex, ey, tolerance, pts!, arcAccum, 0);
        // Fill anchorA/B/T for each newly-appended point (count = arcAccum.length).
        // All interior + final points have A = prevAnchor, B = targetAnchor.
        for (let k = 0; k < arcAccum.length; k++) {
          aA!.push(prevAnchor);
          aB!.push(targetAnchor);
          aT!.push(total > 0 ? arcAccum[k] / total : 0);
        }
        // The final point is exactly the anchor — pin it (A === B, t = 0) so
        // the lerp at draw time returns anchor B's color exactly.
        const lastIdx = (segStart + arcAccum.length) - 1;
        aA![lastIdx] = targetAnchor;
        aB![lastIdx] = targetAnchor;
        aT![lastIdx] = 0;
        prevX = ex; prevY = ey;
        prevAnchor = targetAnchor;
        anchorCounter++;
        coordIdx += 4;
        break;
      }
      case PATH_C: {
        const c1x = coords[coordIdx], c1y = coords[coordIdx + 1];
        const c2x = coords[coordIdx + 2], c2y = coords[coordIdx + 3];
        const ex = coords[coordIdx + 4], ey = coords[coordIdx + 5];
        const targetAnchor = anchorCounter;
        const segStart = pts!.length / 2;
        const arcAccum: number[] = [];
        const total = flattenCubicWithArcLen(prevX, prevY, c1x, c1y, c2x, c2y, ex, ey, tolerance, pts!, arcAccum, 0);
        for (let k = 0; k < arcAccum.length; k++) {
          aA!.push(prevAnchor);
          aB!.push(targetAnchor);
          aT!.push(total > 0 ? arcAccum[k] / total : 0);
        }
        const lastIdx = (segStart + arcAccum.length) - 1;
        aA![lastIdx] = targetAnchor;
        aB![lastIdx] = targetAnchor;
        aT![lastIdx] = 0;
        prevX = ex; prevY = ey;
        prevAnchor = targetAnchor;
        anchorCounter++;
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

  if (current) commit();
  return out;
}
