import { forEachSegment, PATH_M, PATH_L, PATH_Z, PATH_C, PATH_Q } from '../commands';
import { resolveCorners } from '../paths/corners';
import { rectToContour } from '../box';
import { DEFAULT_FLATTEN_TOLERANCE, flattenCubicWithArcLen, flattenQuadraticWithArcLen } from '../flatten';
import type { Path, PolygonPath, RectPath } from '../path';

/** One contour of a path, flattened to straight segments. */
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
  /** A closed contour's last anchor when it repeated the first point and was
   *  dropped for that; the closing edge ends at it. */
  closeAnchor?: number;
  /** Per-point stroke width, populated by the tessellator when the Stroke
   *  carries `vertexWidths`. Undefined means uniform `Stroke.width`. */
  widths?: Float32Array;
  /** Per-point distance the ribbon's middle sits off the path toward the
   *  normal `(−dy, dx)` of the direction of travel: half the right edge's
   *  distance less the left's. Set alongside `widths` only when the two sides
   *  differ somewhere; undefined means centered. */
  offsets?: Float32Array;
}

/** Options for `extractPolylines`. */
export interface ExtractOptions {
  flattenTolerance?: number;
  /** How far out from the path its outermost edge sits, as a stroke's half
   *  width does. Flattening keeps that edge within `flattenTolerance` of the
   *  true one too. Unset, only the path itself is. */
  offset?: number;
}

/** Flatten each contour of a path to a straight-segment polyline, carrying the
 *  anchor parameterization per point. A rect yields one closed contour. */
export function extractPolylines(path: Path, opts: ExtractOptions = {}): Polyline[] {
  if (path.kind === 'rect') return [extractRect(path)];
  return extractPolygon(resolveCorners(path), opts);
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


/** The polylines of one path as they are built: the contour being appended to, and its per-point anchors. */
interface ContourBuilder {
  /** Commit the open contour, if any, and open an empty one. */
  begin(): void;
  /** The open contour's interleaved points, for a flattener to append to. */
  points(): number[];
  /** Append a point sitting on `anchor`. */
  pushAnchor(x: number, y: number, anchor: number): void;
  /**
   * Fill anchorA/B/T for each point a curve just appended from `segStart`: interior points
   * interpolate (`from` → `to`), and the final point is pinned to `to` so the draw-time lerp
   * returns anchor B's color exactly.
   */
  pushCurveAnchors(segStart: number, arcAccum: number[], total: number, from: number, to: number): void;
  /** Mark the open contour closed, dropping a last point that repeats its first. */
  close(): void;
  /** Commit the open contour and answer every contour built. */
  finish(): Polyline[];
}

function createContourBuilder(): ContourBuilder {
  const out: Polyline[] = [];
  let pts: number[] | null = null;
  let aA: number[] | null = null;
  let aB: number[] | null = null;
  let aT: number[] | null = null;
  let current: Polyline | null = null;
  let dropped: number | undefined;

  const commit = (target: Polyline): void => {
    if (!pts || !aA || !aB || !aT) return;
    target.anchorA = new Uint32Array(aA);
    target.anchorB = new Uint32Array(aB);
    target.anchorT = new Float32Array(aT);
    if (dropped !== undefined) target.closeAnchor = dropped;
    dropped = undefined;
  };

  return {
    begin() {
      if (current) commit(current);
      pts = [];
      aA = [];
      aB = [];
      aT = [];
      current = { points: pts, closed: false };
      out.push(current);
    },
    points: () => pts!,
    pushAnchor(x, y, anchor) {
      pts!.push(x, y);
      aA!.push(anchor);
      aB!.push(anchor);
      aT!.push(0);
    },
    pushCurveAnchors(segStart, arcAccum, total, from, to) {
      for (let k = 0; k < arcAccum.length; k++) {
        aA!.push(from);
        aB!.push(to);
        aT!.push(total > 0 ? arcAccum[k] / total : 0);
      }
      const lastIdx = (segStart + arcAccum.length) - 1;
      aA![lastIdx] = to;
      aB![lastIdx] = to;
      aT![lastIdx] = 0;
    },
    close() {
      if (!current) return;
      current.closed = true;
      if (pts && aA && aB && aT) dropped = dropDuplicateClosingPoint(pts, aA, aB, aT) ?? dropped;
    },
    finish() {
      if (current) commit(current);
      return out;
    },
  };
}

function extractPolygon(p: PolygonPath, opts: ExtractOptions): Polyline[] {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { commands, coords } = p;
  const b = createContourBuilder();
  // Anchors are numbered globally (across all contours) in command-stream order.
  let anchorCounter = 0;
  let prevAnchor = -1;
  // The anchor a subpath opened by a bare drawing command starts from.
  let startAnchor = 0;

  forEachSegment(commands, coords, (cmd, coordIdx, prevX, prevY, _i, opensSubpath) => {
    if (opensSubpath) {
      b.begin();
      b.pushAnchor(prevX, prevY, startAnchor);
      prevAnchor = startAnchor;
    }
    switch (cmd) {
      case PATH_M:
      case PATH_L: {
        if (cmd === PATH_M) {
          b.begin();
          startAnchor = anchorCounter;
        }
        b.pushAnchor(coords[coordIdx], coords[coordIdx + 1], anchorCounter);
        prevAnchor = anchorCounter;
        anchorCounter++;
        break;
      }
      case PATH_Q: {
        const segStart = b.points().length / 2;
        const arcAccum: number[] = [];
        const total = flattenQuadraticWithArcLen(
          prevX, prevY,
          coords[coordIdx], coords[coordIdx + 1],
          coords[coordIdx + 2], coords[coordIdx + 3],
          tolerance, b.points(), arcAccum, opts.offset,
        );
        b.pushCurveAnchors(segStart, arcAccum, total, prevAnchor, anchorCounter);
        prevAnchor = anchorCounter;
        anchorCounter++;
        break;
      }
      case PATH_C: {
        const segStart = b.points().length / 2;
        const arcAccum: number[] = [];
        const total = flattenCubicWithArcLen(
          prevX, prevY,
          coords[coordIdx], coords[coordIdx + 1],
          coords[coordIdx + 2], coords[coordIdx + 3],
          coords[coordIdx + 4], coords[coordIdx + 5],
          tolerance, b.points(), arcAccum, opts.offset,
        );
        b.pushCurveAnchors(segStart, arcAccum, total, prevAnchor, anchorCounter);
        prevAnchor = anchorCounter;
        anchorCounter++;
        break;
      }
      case PATH_Z:
        b.close();
        break;
      default:
        throw new Error(`extractPolylines: unknown command code ${cmd}`);
    }
  });

  return b.finish();
}


/**
 * A closed contour's last point repeating its first leaves a zero-length
 * closing segment, which the stroker discards along with the wrap-around
 * join it should have carried, notching the ribbon at the contour's start.
 * Every font outline serialized by opentype.js is written this way. Exact
 * equality is the right test: the duplicate is a re-emission of the same
 * number, and a near-miss is a genuine (if tiny) segment the author asked for.
 * Answers the dropped point's anchor, when it was one.
 */
function dropDuplicateClosingPoint(pts: number[], aA: number[], aB: number[], aT: number[]): number | undefined {
  const n = pts.length / 2;
  if (n < 2) return undefined;
  if (pts[0] !== pts[(n - 1) * 2] || pts[1] !== pts[(n - 1) * 2 + 1]) return undefined;
  const anchor = aA[n - 1] === aB[n - 1] ? aA[n - 1] : undefined;
  pts.length -= 2;
  aA.length -= 1;
  aB.length -= 1;
  aT.length -= 1;
  return anchor;
}
