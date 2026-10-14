/**
 * Corner expansion: a path's corner specs turned into the plain geometry
 * that every reader draws, hits, bounds, and exports.
 */
import type { Path, PolygonPath } from '../path';
import { PathBuilder } from './builder';
import { cornerAt, hasCorners, withoutCorners, type CornerSpec, type CornerStyle } from './cornerSpec';
import {
  decodeContours, paramAtLength, pointAt, segLength, subCubic, tangentAt,
  type Contour, type Vec,
} from './cornerSegments';

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
  bisector: Vec;
  /** Half the angle between the two edges at the anchor. */
  halfAngle: number;
  /** How far along each edge the stored spec cuts, after clamping. */
  trim: number;
  /** The longest cut the edges allow while the neighbors keep theirs. */
  maxTrim: number;
}

/** How far along each edge a corner of `style` and `radius` cuts, at an
 *  anchor whose edges meet at `2 * halfAngle`. */
export function cornerTrimOf(style: CornerStyle, radius: number, halfAngle: number): number {
  return style === 'round' ? radius / Math.tan(halfAngle) : radius;
}

/** The radius of a `style` corner that cuts `trim` along each edge. */
export function cornerRadiusOf(style: CornerStyle, trim: number, halfAngle: number): number {
  return style === 'round' ? trim * Math.tan(halfAngle) : trim;
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
    const want = spec ? cornerTrimOf(spec.style, spec.radius, halfAngle) : 0;
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

const expanded = new WeakMap<PolygonPath, PolygonPath>();

/**
 * `path` with its corner specs expanded into plain geometry and dropped: a
 * round corner becomes a tangent arc, a chamfer a straight cut, an inverted
 * corner an arc centered on the anchor. Each cut is clamped so the cuts on
 * either end of a segment never overlap. A path with no corners comes back
 * as itself, and so does a rect.
 */
export function resolveCorners<P extends Path>(path: P): P;
export function resolveCorners(path: Path): Path {
  if (path.kind !== 'polygon' || path.corners === undefined) return path;
  const hit = expanded.get(path);
  if (hit) return hit;
  const out = hasCorners(path) ? expand(path) : withoutCorners(path);
  expanded.set(path, out);
  return out;
}

function expand(path: PolygonPath): PolygonPath {
  const contours = decodeContours(path);
  if (!contours) return withoutCorners(path);
  const b = new PathBuilder();
  for (const c of contours) emitContour(b, c, contourCuts(path, c));
  const { commands, coords } = b.build();
  return { ...withoutCorners(path), commands, coords };
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

function emitContour(b: PathBuilder, c: Contour, cuts: readonly (AnchorCut | null)[]): void {
  const n = c.anchors.length;
  const spans = c.segs.map((_s, k) => segSpan(c, cuts, k));
  const start = c.closed && c.segs.length > 0 ? pointAt(c.segs[0], spans[0][0]) : c.anchors[0];
  b.moveTo(start.x, start.y);
  c.segs.forEach((seg, k) => {
    const [t0, t1] = spans[k];
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
    const j = (k + 1) % n;
    const cut = cuts[j];
    const next = c.segs[j];
    if (!cut?.spec || cut.trim <= 0 || !next) return;
    // The close draws a chamfer that ends where the contour started.
    if (j === 0 && cut.spec.style === 'chamfer') return;
    const p1 = pointAt(seg, t1);
    const p2 = pointAt(next, spans[j][0]);
    emitCut(b, cut.spec.style, { x: cut.frame.x, y: cut.frame.y }, p1, tangentAt(seg, t1), p2, tangentAt(next, spans[j][0]));
  });
  if (c.closed) b.close();
}

function emitCut(
  b: PathBuilder, style: CornerStyle, v: Vec,
  p1: Vec, t1: Vec | null, p2: Vec, t2: Vec | null,
): void {
  if (style === 'chamfer' || !t1 || !t2) { b.lineTo(p2.x, p2.y); return; }
  const cx = p2.x - p1.x, cy = p2.y - p1.y;
  if (style === 'round') {
    const turn = Math.acos(Math.max(-1, Math.min(1, t1.x * t2.x + t1.y * t2.y)));
    if (turn < MIN_TURN) { b.lineTo(p2.x, p2.y); return; }
    const r = Math.hypot(cx, cy) / (2 * Math.sin(turn / 2));
    const h = (4 / 3) * Math.tan(turn / 4) * r;
    b.curveTo(p1.x + t1.x * h, p1.y + t1.y * h, p2.x - t2.x * h, p2.y - t2.y * h, p2.x, p2.y);
    return;
  }
  const r1x = p1.x - v.x, r1y = p1.y - v.y, r2x = p2.x - v.x, r2y = p2.y - v.y;
  const l1 = Math.hypot(r1x, r1y), l2 = Math.hypot(r2x, r2y);
  if (l1 === 0 || l2 === 0) { b.lineTo(p2.x, p2.y); return; }
  const sweep = Math.acos(Math.max(-1, Math.min(1, (r1x * r2x + r1y * r2y) / (l1 * l2))));
  const h = (4 / 3) * Math.tan(sweep / 4) * ((l1 + l2) / 2);
  const u1 = towards(-r1y / l1, r1x / l1, cx, cy);
  const u2 = towards(-r2y / l2, r2x / l2, cx, cy);
  b.curveTo(p1.x + u1.x * h, p1.y + u1.y * h, p2.x - u2.x * h, p2.y - u2.y * h, p2.x, p2.y);
}

/** `(x, y)` or its reverse, whichever points along `(dx, dy)`. */
function towards(x: number, y: number, dx: number, dy: number): Vec {
  return x * dx + y * dy >= 0 ? { x, y } : { x: -x, y: -y };
}
