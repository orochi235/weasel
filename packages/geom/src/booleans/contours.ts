/** Reading a path into contours, and what a set of contours encloses. */

import { segmentsCross } from '../polyline';
import type { Path, PathFillRule } from '../path';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from '../commands';
import type { Point } from '../paths/cubicMath';
import { EPS } from '../scalar';
import { fillsOpenSubpaths } from '../openFill';
import { resolveCorners } from '../paths/corners';
import { worldCoords } from '../paths/pathOrigin';
import { type Contour, evalSeg, derivSeg, reverseContour, sideCoeffs, signChanges } from './contourSegments';

/** The contours a fill of `path` covers: an open subpath closes implicitly
 *  where a fill closes it, and is left out where one does not. */
export function parseContours(path: Path): Contour[] {
  const fillsOpen = path.kind === 'rect' || fillsOpenSubpaths(path);
  return parseSubpaths(path).filter((s) => s.closed || fillsOpen).map((s) => s.segs);
}

export interface Subpath {
  segs: Contour;
  /** Closed by a `Z` (or a rect); the closing edge, if any, is in `segs`. */
  closed: boolean;
}

/**
 * Subpaths of `path` with their segments. With `implicitClose` (the default,
 * as a fill sees them) every subpath ends in its closing edge; without it,
 * only a subpath closed by `Z` does, as a stroke sees them.
 */
export function parseSubpaths(given: Path, implicitClose = true): Subpath[] {
  const path = resolveCorners(given);
  if (path.kind === 'rect') {
    const { x, y, width: w, height: h } = path;
    const p = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    return [{ segs: p.map((q, i) => [q, p[(i + 1) % 4]]), closed: true }];
  }
  const out: Subpath[] = [];
  let cur: Contour = [];
  let start: Point = { x: 0, y: 0 };
  let pen: Point = start;
  const finish = (closed: boolean) => {
    if (cur.length > 0 && (closed || implicitClose) && (pen.x !== start.x || pen.y !== start.y)) {
      cur.push([pen, start]);
    }
    if (cur.length > 0) out.push({ segs: cur, closed });
    cur = [];
    pen = start;
  };
  const c = worldCoords(path);
  let k = 0;
  for (const cmd of path.commands) {
    if (cmd === PATH_M) {
      finish(false);
      start = pen = { x: c[k], y: c[k + 1] };
      k += 2;
    } else if (cmd === PATH_L) {
      const e = { x: c[k], y: c[k + 1] };
      if (e.x !== pen.x || e.y !== pen.y) cur.push([pen, e]);
      pen = e;
      k += 2;
    } else if (cmd === PATH_Q) {
      const e = { x: c[k + 2], y: c[k + 3] };
      cur.push([pen, { x: c[k], y: c[k + 1] }, e]);
      pen = e;
      k += 4;
    } else if (cmd === PATH_C) {
      const e = { x: c[k + 4], y: c[k + 5] };
      cur.push([pen, { x: c[k], y: c[k + 1] }, { x: c[k + 2], y: c[k + 3] }, e]);
      pen = e;
      k += 6;
    } else if (cmd === PATH_Z) {
      finish(true);
    }
  }
  finish(false);
  return out;
}

/** Whether any contour crosses another or itself, judged on a flattening. */
export function contoursIntersect(contours: Contour[], tol: number): boolean {
  type Edge = { x0: number; y0: number; x1: number; y1: number; c: number; i: number; n: number };
  const edges: Edge[] = [];
  contours.forEach((contour, ci) => {
    const pts: Point[] = [];
    for (const s of contour) {
      let n = 1;
      if (s.length > 2) {
        let len = 0;
        for (let i = 0; i + 1 < s.length; i++) len += Math.hypot(s[i + 1].x - s[i].x, s[i + 1].y - s[i].y);
        n = Math.min(64, Math.max(2, Math.ceil(Math.sqrt(len / Math.max(tol, 1e-3)))));
      }
      for (let i = 0; i < n; i++) pts.push(evalSeg(s, i / n));
    }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      edges.push({ x0: p.x, y0: p.y, x1: q.x, y1: q.y, c: ci, i, n: pts.length });
    }
  });
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      const f = edges[j];
      if (e.c === f.c && (j - i === 1 || (i === 0 && f.i === f.n - 1))) continue;
      if (Math.max(e.x0, e.x1) < Math.min(f.x0, f.x1) || Math.max(f.x0, f.x1) < Math.min(e.x0, e.x1)) continue;
      if (Math.max(e.y0, e.y1) < Math.min(f.y0, f.y1) || Math.max(f.y0, f.y1) < Math.min(e.y0, e.y1)) continue;
      if (segmentsCross(e.x0, e.y0, e.x1, e.y1, f.x0, f.y0, f.x1, f.y1)) return true;
    }
  }
  return false;
}

/** Winding number of `q`, by a ray cast in +x against the exact curves. */
export function windingAt(q: Point, contours: Contour[]): number {
  const dir = { x: 1, y: 0 };
  let w = 0;
  for (const contour of contours) {
    for (const s of contour) {
      for (const c of signChanges(sideCoeffs(s, q, dir), true)) {
        if (evalSeg(s, c.t).x > q.x) w += c.after > 0 ? 1 : -1;
      }
    }
  }
  return w;
}

/** The diagonal of the box around every control point of `contours`. */
export function extentOf(contours: Contour[]): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of contours) for (const s of c) for (const p of s) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

/** The area below which a region cut from `contours` is rounding, not a piece. */
export function negligibleArea(contours: Contour[]): number {
  const extent = extentOf(contours);
  return extent * extent * EPS * EPS;
}

/**
 * The contours that bound the fill, each turned so the fill lies on its left.
 * A contour with fill on both sides or neither (a same-direction inner ring
 * under nonzero) bounds nothing and is dropped.
 */
export function orientBoundaries(contours: Contour[], fillRule: PathFillRule): Contour[] {
  const filled = (q: Point) => {
    const w = windingAt(q, contours);
    return fillRule === 'evenodd' ? (w & 1) !== 0 : w !== 0;
  };
  const eps = Math.max(extentOf(contours) * 1e-6, 1e-9);

  const out: Contour[] = [];
  for (const contour of contours) {
    let probe = contour[0];
    let best = -1;
    for (const s of contour) {
      const len = Math.hypot(s[s.length - 1].x - s[0].x, s[s.length - 1].y - s[0].y);
      if (len > best) { best = len; probe = s; }
    }
    const p = evalSeg(probe, 0.5);
    let tan = derivSeg(probe, 0.5);
    const tl = Math.hypot(tan.x, tan.y);
    if (tl === 0) continue;
    tan = { x: tan.x / tl, y: tan.y / tl };
    const left = filled({ x: p.x - tan.y * eps, y: p.y + tan.x * eps });
    const right = filled({ x: p.x + tan.y * eps, y: p.y - tan.x * eps });
    if (left && !right) out.push(contour);
    else if (right && !left) out.push(reverseContour(contour));
  }
  return out;
}
