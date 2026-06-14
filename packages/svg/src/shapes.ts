/**
 * Lower SVG primitive elements (`<rect>`, `<circle>`, `<ellipse>`,
 * `<line>`, `<polyline>`, `<polygon>`) to weasel `Path` values. Each
 * helper applies an optional 2x3 affine matrix to the resulting geometry
 * so the caller can collapse `<g transform="...">` onto leaves.
 *
 * Ellipses and rounded rects use the standard 4-segment cubic Bezier
 * approximation with control offset `k = 4*(sqrt(2)-1)/3 ≈ 0.5523`.
 */

import {
  PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z,
  PathBuilder,
  type Path,
  type PolygonPath,
  type RectPath,
} from '@weasel-js/core';
import type { Matrix } from './types';
import { IDENTITY_MATRIX } from './types';
import { applyMatrix, isIdentity } from './transform';

/** Magic constant: cubic Bezier control offset for a quarter-circle of radius 1. */
const KAPPA = (4 * (Math.sqrt(2) - 1)) / 3;

/** True when `m` represents a pure axis-aligned scale + translate. */
function isAxisAlignedScale(m: Matrix, eps = 1e-9): boolean {
  return Math.abs(m[1]) < eps && Math.abs(m[2]) < eps;
}

/**
 * Apply a 2x3 affine to a `Path`. RectPaths whose matrix is identity or
 * an axis-aligned scale+translate stay as `RectPath`; anything else (any
 * rotation/skew, or any PolygonPath input) is promoted to a `PolygonPath`
 * via a coords-level remap.
 */
export function transformPath(path: Path, m: Matrix): Path {
  if (isIdentity(m)) return path;
  if (path.kind === 'rect') {
    if (isAxisAlignedScale(m)) {
      const a = m[0], d = m[3], e = m[4], f = m[5];
      let x = path.x * a + e;
      let y = path.y * d + f;
      let w = path.width * a;
      let h = path.height * d;
      if (w < 0) { x += w; w = -w; }
      if (h < 0) { y += h; h = -h; }
      return { kind: 'rect', x, y, width: w, height: h };
    }
    // Promote to polygon, then transform.
    return transformPath(rectToPolygon(path), m);
  }
  // PolygonPath: remap every coord pair. Step counts are command-dependent
  // and all the supported commands store coord pairs, so a flat stride-2
  // walk is correct.
  const xs = path.coords;
  const out = new Float32Array(xs.length);
  for (let i = 0; i < xs.length; i += 2) {
    const p = applyMatrix(m, xs[i], xs[i + 1]);
    out[i] = p.x;
    out[i + 1] = p.y;
  }
  return {
    kind: 'polygon',
    commands: new Uint8Array(path.commands),
    coords: out,
    fillRule: path.fillRule,
  };
}

function rectToPolygon(r: RectPath): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(r.x, r.y);
  b.lineTo(r.x + r.width, r.y);
  b.lineTo(r.x + r.width, r.y + r.height);
  b.lineTo(r.x, r.y + r.height);
  b.close();
  return b.build();
}

/**
 * `<rect x y width height rx ry>` → Path. Returns a `RectPath` when there
 * are no corner radii (and matrix is benign); otherwise lowers to a
 * polygon with cubic-curve corners.
 */
export function rectElementToPath(
  x: number, y: number, width: number, height: number,
  rx: number, ry: number,
  m: Matrix = IDENTITY_MATRIX,
): Path {
  if (rx <= 0 && ry <= 0) {
    return transformPath({ kind: 'rect', x, y, width, height }, m);
  }
  const r = Math.min(Math.max(rx, ry), Math.min(width, height) / 2);
  const r2 = Math.min(rx > 0 ? rx : r, ry > 0 ? ry : r, Math.min(width, height) / 2);
  // For simplicity treat rx === ry === r2. Independent rx/ry can be
  // added later; weasel doesn't have a rounded-rect primitive anyway.
  const rad = r2;
  const k = KAPPA * rad;
  const x2 = x + width;
  const y2 = y + height;
  const b = new PathBuilder();
  b.moveTo(x + rad, y);
  b.lineTo(x2 - rad, y);
  b.curveTo(x2 - rad + k, y, x2, y + rad - k, x2, y + rad);
  b.lineTo(x2, y2 - rad);
  b.curveTo(x2, y2 - rad + k, x2 - rad + k, y2, x2 - rad, y2);
  b.lineTo(x + rad, y2);
  b.curveTo(x + rad - k, y2, x, y2 - rad + k, x, y2 - rad);
  b.lineTo(x, y + rad);
  b.curveTo(x, y + rad - k, x + rad - k, y, x + rad, y);
  b.close();
  return transformPath(b.build(), m);
}

/** `<ellipse cx cy rx ry>` → PolygonPath (4 cubic segments). */
export function ellipseToPath(
  cx: number, cy: number, rx: number, ry: number,
  m: Matrix = IDENTITY_MATRIX,
): Path {
  const kx = KAPPA * rx;
  const ky = KAPPA * ry;
  const b = new PathBuilder();
  b.moveTo(cx + rx, cy);
  b.curveTo(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry);
  b.curveTo(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy);
  b.curveTo(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry);
  b.curveTo(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy);
  b.close();
  return transformPath(b.build(), m);
}

/** `<circle cx cy r>` → ellipse with rx === ry. */
export function circleToPath(
  cx: number, cy: number, r: number, m: Matrix = IDENTITY_MATRIX,
): Path {
  return ellipseToPath(cx, cy, r, r, m);
}

/** `<line x1 y1 x2 y2>` → open 2-anchor polygon. */
export function lineToPath(
  x1: number, y1: number, x2: number, y2: number,
  m: Matrix = IDENTITY_MATRIX,
): Path {
  const b = new PathBuilder();
  b.moveTo(x1, y1);
  b.lineTo(x2, y2);
  return transformPath(b.build(), m);
}

/** Parse SVG `points="x1,y1 x2,y2 ..."` to a flat list. */
export function parsePoints(raw: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const nums = raw.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g);
  if (!nums) return out;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    out.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
  }
  return out;
}

/** `<polyline points="...">` → open polygon. */
export function polylineToPath(
  points: readonly { x: number; y: number }[],
  m: Matrix = IDENTITY_MATRIX,
): Path {
  if (points.length === 0) {
    return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
  }
  const b = new PathBuilder();
  b.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) b.lineTo(points[i].x, points[i].y);
  return transformPath(b.build(), m);
}

/** `<polygon points="...">` → closed polygon. */
export function polygonToPath(
  points: readonly { x: number; y: number }[],
  m: Matrix = IDENTITY_MATRIX,
): Path {
  if (points.length === 0) {
    return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
  }
  const b = new PathBuilder();
  b.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) b.lineTo(points[i].x, points[i].y);
  b.close();
  return transformPath(b.build(), m);
}

// Re-export the path opcodes for any callers that want to introspect.
export { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z };
