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
  transformPath,
  type Path,
} from '@weasel-js/core';
import type { Matrix } from './types';
import { IDENTITY_MATRIX } from './types';

/** Magic constant: cubic Bezier control offset for a quarter-circle of radius 1. */
const KAPPA = (4 * (Math.sqrt(2) - 1)) / 3;

/**
 * `<rect x y width height rx ry>` → Path. A radius that is missing, negative
 * or not a number is `auto` and takes the other's value, as SVG 2 has it; each
 * is then clamped to half its own side. No radius left gives a `RectPath`.
 */
export function rectElementToPath(
  x: number, y: number, width: number, height: number,
  rx: number, ry: number,
  m: Matrix = IDENTITY_MATRIX,
): Path {
  const given = (r: number): number | null => (Number.isFinite(r) && r >= 0 ? r : null);
  const rxGiven = given(rx);
  const ryGiven = given(ry);
  const ax = Math.min(rxGiven ?? ryGiven ?? 0, width / 2);
  const ay = Math.min(ryGiven ?? rxGiven ?? 0, height / 2);
  if (!(ax > 0 && ay > 0)) {
    return transformPath({ kind: 'rect', x, y, width, height }, m);
  }
  const kx = KAPPA * ax;
  const ky = KAPPA * ay;
  const x2 = x + width;
  const y2 = y + height;
  const b = new PathBuilder().autoOrigin();
  b.moveTo(x + ax, y);
  b.lineTo(x2 - ax, y);
  b.curveTo(x2 - ax + kx, y, x2, y + ay - ky, x2, y + ay);
  b.lineTo(x2, y2 - ay);
  b.curveTo(x2, y2 - ay + ky, x2 - ax + kx, y2, x2 - ax, y2);
  b.lineTo(x + ax, y2);
  b.curveTo(x + ax - kx, y2, x, y2 - ay + ky, x, y2 - ay);
  b.lineTo(x, y + ay);
  b.curveTo(x, y + ay - ky, x + ax - kx, y, x + ax, y);
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
  const b = new PathBuilder().autoOrigin();
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
  const b = new PathBuilder().autoOrigin();
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
  const b = new PathBuilder().autoOrigin();
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
  const b = new PathBuilder().autoOrigin();
  b.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) b.lineTo(points[i].x, points[i].y);
  b.close();
  return transformPath(b.build(), m);
}

// Re-export the path opcodes for any callers that want to introspect.
export { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z };
