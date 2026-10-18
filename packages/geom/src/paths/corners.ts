/**
 * Corner expansion: a path's corner specs turned into the plain geometry
 * that every reader draws, hits, bounds, and exports.
 */
import type { Path, PolygonPath } from '../path';
import { PathBuilder } from './builder';
import { cornerAt, hasCorners, withoutCorners, type CornerSpec } from './cornerSpec';
import { cornerShapeK, cornerShapePieces, type CornerPiece, type CornerShapeFrame } from './cornerShape';
import {
  decodeContours, paramAtLength, pointAt, segLength, subCubic, tangentAt,
  type Contour,
} from './cornerSegments';
import type { Point } from './cubicMath';

/** Below this turn (radians) an anchor is smooth, and no corner can be cut. */
const MIN_TURN = 1e-3;

/** Where and how a corner anchor can be cut. */
export interface CornerFrame {
  /** Flat anchor index. */
  index: number;
  /** The anchor. */
  x: number;
  y: number;
  /** Unit direction from the anchor into the wedge the cut is taken from. */
  bisector: Point;
  /** Half the angle between the two edges at the anchor. */
  halfAngle: number;
  /** How far along each edge the stored spec cuts, its setback, after clamping. */
  trim: number;
  /** The longest cut the edges allow while the neighbors keep theirs. */
  maxTrim: number;
}

interface AnchorCut {
  frame: Omit<CornerFrame, 'trim' | 'maxTrim'>;
  spec: CornerSpec | null;
  want: number;
  trim: number;
}

/** The cut each anchor of `c` takes, clamped so that the two cuts on any
 *  segment never meet past each other. Null for an anchor that cannot be cut. */
function contourCuts(path: PolygonPath, c: Contour): (AnchorCut | null)[] {
  const n = c.anchors.length;
  const lengths = c.segs.map(segLength);
  const cuts: (AnchorCut | null)[] = c.anchors.map((a, i) => {
    const inSeg = i > 0 ? c.segs[i - 1] : c.closed ? c.segs[n - 1] : null;
    const outSeg = i < c.segs.length ? c.segs[i] : null;
    if (!inSeg || !outSeg || inSeg === outSeg) return null;
    const tIn = tangentAt(inSeg, 1);
    const tOut = tangentAt(outSeg, 0);
    if (!tIn || !tOut) return null;
    const turn = Math.acos(Math.max(-1, Math.min(1, tIn.x * tOut.x + tIn.y * tOut.y)));
    if (turn < MIN_TURN || turn > Math.PI - MIN_TURN) return null;
    const bx = tOut.x - tIn.x, by = tOut.y - tIn.y;
    const bl = Math.hypot(bx, by);
    const halfAngle = (Math.PI - turn) / 2;
    const spec = cornerAt(path, c.first + i);
    const want = spec ? spec.radius : 0;
    return {
      frame: { index: c.first + i, x: a.x, y: a.y, bisector: { x: bx / bl, y: by / bl }, halfAngle },
      spec,
      want,
      trim: want,
    };
  });
  const scale = cuts.map(() => 1);
  c.segs.forEach((_seg, k) => {
    const a = k, b = (k + 1) % n;
    const sum = (cuts[a]?.want ?? 0) + (cuts[b]?.want ?? 0);
    if (sum <= lengths[k]) return;
    const f = lengths[k] / sum;
    scale[a] = Math.min(scale[a], f);
    scale[b] = Math.min(scale[b], f);
  });
  cuts.forEach((cut, i) => { if (cut) cut.trim = cut.want * scale[i]; });
  return cuts;
}

/** Every anchor of `path` that can take a corner, with the cut its spec
 *  makes now. */
export function cornerFrames(path: PolygonPath): CornerFrame[] {
  const contours = decodeContours(path);
  if (!contours) return [];
  const out: CornerFrame[] = [];
  for (const c of contours) {
    const cuts = contourCuts(path, c);
    const n = c.anchors.length;
    cuts.forEach((cut, i) => {
      if (!cut) return;
      const prev = (i - 1 + n) % n;
      const next = (i + 1) % n;
      const inLen = segLength(c.segs[prev]);
      const outLen = segLength(c.segs[i]);
      const room = (len: number, j: number): number => len - Math.min(len, cuts[j]?.want ?? 0);
      out.push({
        ...cut.frame,
        trim: cut.trim,
        maxTrim: Math.max(0, Math.min(room(inLen, prev), room(outLen, next))),
      });
    });
  }
  return out;
}

/** The frame of the corner at flat anchor `index`, or null when that anchor
 *  cannot take one. */
export function cornerFrameAt(path: PolygonPath, index: number): CornerFrame | null {
  return cornerFrames(path).find((f) => f.index === index) ?? null;
}

/** A path with its corners expanded, and where its anchors came from. */
export interface ResolvedCorners {
  path: PolygonPath;
  /**
   * For each anchor of `path` (each M, L, C, or Q, as `countPathAnchors`
   * counts them), the anchor of the source path it belongs to, in the same
   * numbering. Every point a corner's cut adds belongs to that corner's
   * anchor. Null when the expansion added none.
   */
  anchorSources: Uint32Array | null;
}

const expanded = new WeakMap<PolygonPath, ResolvedCorners>();

/** {@link resolveCorners}, also answering which source anchor each anchor of
 *  the result came from, so an array kept per anchor (`vertexColors`) can be
 *  carried onto it with {@link remapPerAnchor}. */
export function resolveCornersWithSources(path: PolygonPath): ResolvedCorners {
  if (path.corners === undefined) return { path, anchorSources: null };
  const hit = expanded.get(path);
  if (hit) return hit;
  const out = hasCorners(path) ? expand(path) : { path: withoutCorners(path), anchorSources: null };
  expanded.set(path, out);
  return out;
}

/**
 * `path` with its corner specs expanded into plain geometry and dropped: each
 * corner is cut `radius` along both edges and spans the cut with its shape's
 * superellipse (`cornerShapePieces`). Each cut is clamped so the cuts on
 * either end of a segment never overlap. A path with no corners comes back
 * as itself, and so does a rect.
 */
export function resolveCorners<P extends Path>(path: P): P;
export function resolveCorners(path: Path): Path {
  if (path.kind !== 'polygon') return path;
  return resolveCornersWithSources(path).path;
}

/** `values`, `stride` numbers per source anchor, as `stride` per anchor of
 *  the expanded path that `sources` describes. */
export function remapPerAnchor<T>(values: readonly T[], sources: Uint32Array, stride: number): T[] {
  const out = new Array<T>(sources.length * stride);
  for (let i = 0; i < sources.length; i++) {
    for (let k = 0; k < stride; k++) out[i * stride + k] = values[sources[i] * stride + k];
  }
  return out;
}

/** A `PathBuilder` that records, for each anchor it writes, the source anchor `src`. */
class Emitter {
  readonly b = new PathBuilder();
  readonly sources: number[] = [];
  src = 0;
  moveTo(x: number, y: number): void { this.b.moveTo(x, y); this.sources.push(this.src); }
  lineTo(x: number, y: number): void { this.b.lineTo(x, y); this.sources.push(this.src); }
  curveTo(a: number, b: number, c: number, d: number, x: number, y: number): void {
    this.b.curveTo(a, b, c, d, x, y);
    this.sources.push(this.src);
  }
  close(): void { this.b.close(); }
}

function expand(path: PolygonPath): ResolvedCorners {
  const contours = decodeContours(path);
  if (!contours) return { path: withoutCorners(path), anchorSources: null };
  const e = new Emitter();
  for (const c of contours) emitContour(e, c, contourCuts(path, c));
  const { commands, coords } = e.b.build();
  return {
    path: { ...withoutCorners(path), commands, coords },
    anchorSources: Uint32Array.from(e.sources),
  };
}

/** Parameter on segment `k` where the cut at its start ends, and where the
 *  cut at its end begins. */
function segSpan(c: Contour, cuts: readonly (AnchorCut | null)[], k: number): [number, number] {
  const seg = c.segs[k];
  const len = segLength(seg);
  const t0 = paramAtLength(seg, cuts[k]?.trim ?? 0);
  const t1 = paramAtLength(seg, len - (cuts[(k + 1) % c.anchors.length]?.trim ?? 0));
  return [t0, Math.max(t0, t1)];
}

/** The corner cut at the anchor segment `k` runs into, as the expansion
 *  draws it, or null when that anchor takes none. */
function cutAfter(
  c: Contour, cuts: readonly (AnchorCut | null)[], spans: readonly [number, number][], k: number,
): { cut: AnchorCut; start: Point; end: Point; pieces: CornerPiece[] } | null {
  const j = (k + 1) % c.anchors.length;
  const cut = cuts[j];
  const next = c.segs[j];
  if (!cut?.spec || cut.trim <= 0 || !next) return null;
  const seg = c.segs[k];
  const start = pointAt(seg, spans[k][1]);
  const end = pointAt(next, spans[j][0]);
  const frame = shapeFrame({ x: cut.frame.x, y: cut.frame.y }, start, tangentAt(seg, spans[k][1]), end, tangentAt(next, spans[j][0]));
  return { cut, start, end, pieces: cornerShapePieces(cornerShapeK(cut.spec.shape), frame) };
}

/** One corner of a path as its expansion draws it. */
export interface CornerCut {
  /** Flat anchor index. */
  index: number;
  anchor: Point;
  spec: CornerSpec;
  /** Where the cut leaves the edge into the anchor, and where it rejoins the edge out of it. */
  start: Point;
  end: Point;
  /** The outline from `start` to `end`. */
  pieces: CornerPiece[];
}

/** Every corner `path` cuts, in path order. */
export function cornerCuts(path: PolygonPath): CornerCut[] {
  if (!hasCorners(path)) return [];
  const out: CornerCut[] = [];
  for (const c of decodeContours(path) ?? []) {
    const cuts = contourCuts(path, c);
    const spans = c.segs.map((_s, k) => segSpan(c, cuts, k));
    c.segs.forEach((_seg, k) => {
      const at = cutAfter(c, cuts, spans, k);
      if (!at) return;
      const { frame } = at.cut;
      out.push({ index: frame.index, anchor: { x: frame.x, y: frame.y }, spec: at.cut.spec!, start: at.start, end: at.end, pieces: at.pieces });
    });
  }
  return out;
}

function emitContour(b: Emitter, c: Contour, cuts: readonly (AnchorCut | null)[]): void {
  const n = c.anchors.length;
  const spans = c.segs.map((_s, k) => segSpan(c, cuts, k));
  const start = c.closed && c.segs.length > 0 ? pointAt(c.segs[0], spans[0][0]) : c.anchors[0];
  b.src = c.sources[0];
  b.moveTo(start.x, start.y);
  c.segs.forEach((seg, k) => {
    const [t0, t1] = spans[k];
    // Both the run up to the next anchor and the cut at it belong to that anchor.
    b.src = c.sources[(k + 1) % n];
    const closing = c.closed && k === n - 1 && !(cuts[0]?.spec && cuts[0].trim > 0);
    if (t1 > t0 && !(closing && seg.line)) {
      if (seg.line) {
        const p = pointAt(seg, t1);
        b.lineTo(p.x, p.y);
      } else {
        const [c1, c2, p3] = subCubic(seg, t0, t1);
        b.curveTo(c1.x, c1.y, c2.x, c2.y, p3.x, p3.y);
      }
    }
    const at = cutAfter(c, cuts, spans, k);
    if (!at) return;
    const pieces = [...at.pieces];
    // A closing line that ends where the contour started is drawn by the close.
    if ((k + 1) % n === 0 && pieces.at(-1)?.kind === 'line') pieces.pop();
    for (const piece of pieces) {
      if (piece.kind === 'line') b.lineTo(piece.to.x, piece.to.y);
      else b.curveTo(piece.c1.x, piece.c1.y, piece.c2.x, piece.c2.y, piece.to.x, piece.to.y);
    }
  });
  if (c.closed) b.close();
}

/** The frame a corner's shape spans: from `p1` to `p2`, around where the two
 *  edges' tangents there meet. That is the anchor itself between straight
 *  edges; between curves it keeps every convex shape tangent to both. */
function shapeFrame(v: Point, p1: Point, t1: Point | null, p2: Point, t2: Point | null): CornerShapeFrame {
  const outer = t1 && t2 ? tangentMeet(p1, t1, p2, t2) : null;
  const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const far = !outer || Math.hypot(outer.x - v.x, outer.y - v.y) > 4 * chord;
  return { start: p1, end: p2, outer: far ? v : outer };
}

/** Where the line through `a` along `ta` meets the one through `b` along
 *  `tb`, or null when they are parallel. */
function tangentMeet(a: Point, ta: Point, b: Point, tb: Point): Point | null {
  const den = ta.x * tb.y - ta.y * tb.x;
  if (Math.abs(den) < 1e-9) return null;
  const s = ((b.x - a.x) * tb.y - (b.y - a.y) * tb.x) / den;
  return { x: a.x + ta.x * s, y: a.y + ta.y * s };
}
