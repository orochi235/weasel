import type { PolygonPath } from '../path';
import { anchorsToPath, pathToAnchors, type PenAnchor } from '../paths/anchors';
import { cubicPointAt, type Point } from '../paths/cubicMath';
import { fitPointRun } from '../paths/fitRun';

/** Options for {@link warpPath}. */
export interface WarpPathOptions {
  /** How far, in output units, the refitted curves may stray from the warped
   *  original. Default 0.5. */
  tolerance?: number;
}

const MIN_SAMPLES = 8;
const MAX_SAMPLES = 64;
/** How far along a segment, as a curve parameter, its end tangent is read. */
const TANGENT_STEP = 1e-3;

/**
 * `path` carried through `map`, point by point, and refitted as cubics within
 * `tolerance` of the warped curve. Every anchor stays an anchor, at the point
 * it maps to, so the result edits like the original; a segment the map keeps
 * straight stays a straight segment, and one it bends gains anchors only where
 * one cubic cannot follow it. Fill rules carry over.
 */
export function warpPath(
  path: PolygonPath,
  map: (p: Point) => Point,
  opts: WarpPathOptions = {},
): PolygonPath {
  const tol = Math.max(opts.tolerance ?? 0.5, 1e-6);
  const { anchors, closed } = pathToAnchors(path);
  const out: PenAnchor[][] = anchors.map((sub, s) => warpSubpath(sub, closed[s], map, tol));
  return anchorsToPath(out, closed, path);
}

function warpSubpath(sub: PenAnchor[], closed: boolean, map: (p: Point) => Point, tol: number): PenAnchor[] {
  const n = sub.length;
  if (n === 0) return [];
  const out: PenAnchor[] = [];
  const segments = closed && n > 1 ? n : n - 1;
  if (segments === 0) return [map(sub[0])];
  for (let i = 0; i < segments; i++) {
    const a = sub[i];
    const b = sub[(i + 1) % n];
    const at = segmentAt(a, b);
    const count = sampleCount(a, b, tol);
    const pts: Point[] = [];
    for (let k = 0; k <= count; k++) pts.push(map(at(k / count)));
    const start = pts[0];
    const end = pts[pts.length - 1];
    const tStart = unit(sub2(map(at(TANGENT_STEP)), start));
    const tEnd = unit(sub2(map(at(1 - TANGENT_STEP)), end));
    const run = dedupe(pts);
    const closing = closed && i === segments - 1;
    if (run.length < 2) {
      if (out.length === 0) out.push({ x: start.x, y: start.y });
      if (!closing) out.push({ x: end.x, y: end.y });
      continue;
    }
    fitPointRun(run, tStart, tEnd, tol, out, closing);
  }
  return out;
}

/** The segment from `a` to `b` as a function of its curve parameter. */
function segmentAt(a: PenAnchor, b: PenAnchor): (t: number) => Point {
  if (!a.outHandle && !b.inHandle) return (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const c1 = a.outHandle ?? a;
  const c2 = b.inHandle ?? b;
  return (t) => cubicPointAt(a, c1, c2, b, t);
}

/** Samples enough to resolve a bend on the scale of the tolerance, within bounds. */
function sampleCount(a: PenAnchor, b: PenAnchor, tol: number): number {
  const c1 = a.outHandle ?? a;
  const c2 = b.inHandle ?? b;
  const len = Math.hypot(c1.x - a.x, c1.y - a.y) + Math.hypot(c2.x - c1.x, c2.y - c1.y) + Math.hypot(b.x - c2.x, b.y - c2.y);
  return Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Math.ceil(len / (8 * tol))));
}

function dedupe(pts: Point[]): Point[] {
  return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
}

const sub2 = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
function unit(p: Point): Point {
  const len = Math.hypot(p.x, p.y);
  return len === 0 ? { x: 0, y: 0 } : { x: p.x / len, y: p.y / len };
}
