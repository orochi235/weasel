import { forEachSegment, rectToContour } from '@weasel-js/geom';
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
} from '@weasel-js/core';

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
  /** Per-point stroke width, populated by the tessellator when the Stroke
   *  carries `vertexWidths`. Undefined means uniform `Stroke.width`. */
  widths?: Float32Array;
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
    points: Array.from(rectToContour(x, y, w, h)),
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

  let prevAnchor = -1;

  const beginContour = (): Polyline => {
    pts = [];
    aA = [];
    aB = [];
    aT = [];
    const next: Polyline = { points: pts, closed: false };
    out.push(next);
    return next;
  };

  /**
   * A closed contour's last point repeating its first is redundant — Z already
   * says "return to the start" — and it is *harmful*: it leaves a zero-length
   * closing segment, which the stroker discards along with the wrap-around
   * join it should have carried, notching the ribbon at the contour's start.
   *
   * Every font outline serialized by opentype.js is written this way, as is a
   * great deal of hand-written and exported SVG, so this is the common case
   * rather than a defensive edge. Exact equality is the right test: the
   * duplicate is a re-emission of the same number, not an approach to it, and
   * a near-miss is a genuine (if tiny) segment the author asked for.
   */
  const dropDuplicateClosingPoint = (): void => {
    if (!pts || !aA || !aB || !aT) return;
    const n = pts.length / 2;
    if (n < 2) return;
    if (pts[0] !== pts[(n - 1) * 2] || pts[1] !== pts[(n - 1) * 2 + 1]) return;
    pts.length -= 2;
    aA.length -= 1;
    aB.length -= 1;
    aT.length -= 1;
  };

  const commit = (target: Polyline): void => {
    if (!pts || !aA || !aB || !aT) return;
    target.anchorA = new Uint32Array(aA);
    target.anchorB = new Uint32Array(aB);
    target.anchorT = new Float32Array(aT);
  };

  // Fill anchorA/B/T for each point a curve just appended: interior points
  // interpolate (prevAnchor → target), and the final point is pinned to the
  // target so the draw-time lerp returns anchor B's color exactly.
  const pushCurveAnchors = (segStart: number, arcAccum: number[], total: number, target: number): void => {
    for (let k = 0; k < arcAccum.length; k++) {
      aA!.push(prevAnchor);
      aB!.push(target);
      aT!.push(total > 0 ? arcAccum[k] / total : 0);
    }
    const lastIdx = (segStart + arcAccum.length) - 1;
    aA![lastIdx] = target;
    aB![lastIdx] = target;
    aT![lastIdx] = 0;
  };

  forEachSegment(commands, coords, (cmd, coordIdx, prevX, prevY) => {
    switch (cmd) {
      case PATH_M:
      case PATH_L: {
        if (cmd === PATH_M) {
          if (current) commit(current);
          current = beginContour();
        }
        pts!.push(coords[coordIdx], coords[coordIdx + 1]);
        aA!.push(anchorCounter);
        aB!.push(anchorCounter);
        aT!.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        break;
      }
      case PATH_Q: {
        const target = anchorCounter;
        const segStart = pts!.length / 2;
        const arcAccum: number[] = [];
        const total = flattenQuadraticWithArcLen(
          prevX, prevY,
          coords[coordIdx], coords[coordIdx + 1],
          coords[coordIdx + 2], coords[coordIdx + 3],
          tolerance, pts!, arcAccum,
        );
        pushCurveAnchors(segStart, arcAccum, total, target);
        prevAnchor = target;
        anchorCounter++;
        break;
      }
      case PATH_C: {
        const target = anchorCounter;
        const segStart = pts!.length / 2;
        const arcAccum: number[] = [];
        const total = flattenCubicWithArcLen(
          prevX, prevY,
          coords[coordIdx], coords[coordIdx + 1],
          coords[coordIdx + 2], coords[coordIdx + 3],
          coords[coordIdx + 4], coords[coordIdx + 5],
          tolerance, pts!, arcAccum,
        );
        pushCurveAnchors(segStart, arcAccum, total, target);
        prevAnchor = target;
        anchorCounter++;
        break;
      }
      case PATH_Z: {
        if (current) {
          current.closed = true;
          dropDuplicateClosingPoint();
        }
        break;
      }
      default:
        throw new Error(`extractPolylines: unknown command code ${cmd}`);
    }
  });

  if (current) commit(current);
  return out;
}
