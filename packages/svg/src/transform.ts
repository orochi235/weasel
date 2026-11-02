/**
 * SVG transform attribute helpers: parses a `transform` list into a single 2x3
 * affine matrix, and exposes the mappers that collapse `transform=` onto leaf
 * geometry at parse time.
 */

import { applyToPoint, invert, multiply } from '@weasel-js/geom';
import type { Matrix } from './types';
import { IDENTITY_MATRIX } from './types';

/** Compose two 2x3 affines, `a` then `b` applied to a column vector. The
 *  kernel's own composition — `Matrix` is `Affine`, so nothing converts. */
export { multiply };

/** geom's `applyToPoint` in the `{x, y}` spelling the rest of this package works in. */
export function applyMatrix(m: Matrix, x: number, y: number): { x: number; y: number } {
  const [px, py] = applyToPoint(m, x, y);
  return { x: px, y: py };
}

/** True if `m` is the identity within a small epsilon. */
export function isIdentity(m: Matrix, eps = 1e-9): boolean {
  return (
    Math.abs(m[0] - 1) < eps &&
    Math.abs(m[1]) < eps &&
    Math.abs(m[2]) < eps &&
    Math.abs(m[3] - 1) < eps &&
    Math.abs(m[4]) < eps &&
    Math.abs(m[5]) < eps
  );
}

const NUM_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

function readNumbers(s: string): number[] {
  const out: number[] = [];
  const matches = s.match(NUM_RE);
  if (!matches) return out;
  for (const m of matches) {
    const n = Number(m);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Parse an SVG `transform="..."` string into a single 2x3 matrix. In
 * `transform="A B"`, the rightmost function is applied first to a point's
 * local coordinates. Unrecognized functions warn and are skipped; the rest of
 * the transform list still applies.
 */
export function parseTransform(
  attr: string | null | undefined,
  onWarn?: (message: string) => void,
): Matrix {
  if (!attr) return IDENTITY_MATRIX;
  let result: Matrix = IDENTITY_MATRIX;
  // Split into "name(args)" chunks.
  const fnRe = /([A-Za-z]+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = fnRe.exec(attr)) !== null) {
    const name = match[1].toLowerCase();
    const nums = readNumbers(match[2]);
    let local: Matrix | null = null;
    if (name === 'matrix' && nums.length >= 6) {
      local = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
    } else if (name === 'translate') {
      const tx = nums[0] ?? 0;
      const ty = nums[1] ?? 0;
      local = [1, 0, 0, 1, tx, ty];
    } else if (name === 'scale') {
      const sx = nums[0] ?? 1;
      const sy = nums.length >= 2 ? nums[1] : sx;
      local = [sx, 0, 0, sy, 0, 0];
    } else if (name === 'rotate') {
      const ang = ((nums[0] ?? 0) * Math.PI) / 180;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const rot: Matrix = [c, s, -s, c, 0, 0];
      if (nums.length >= 3) {
        // rotate(angle, cx, cy) = translate(cx,cy) * rotate * translate(-cx,-cy)
        const cx = nums[1];
        const cy = nums[2];
        local = multiply(multiply([1, 0, 0, 1, cx, cy], rot), [1, 0, 0, 1, -cx, -cy]);
      } else {
        local = rot;
      }
    } else if (name === 'skewx' || name === 'skewy') {
      const ang = ((nums[0] ?? 0) * Math.PI) / 180;
      const t = Math.tan(ang);
      local = name === 'skewx' ? [1, 0, t, 1, 0, 0] : [1, t, 0, 1, 0, 0];
    } else {
      onWarn?.(`unsupported transform function: ${name}`);
      continue;
    }
    result = multiply(result, local);
  }
  return result;
}

/**
 * Re-express an element's own `transform` in the frame its inherited `ctm`
 * maps into: `ctm * local * ctm⁻¹`.
 *
 * A leaf's geometry is baked through `ctm` at parse time, so its own
 * transform has to move with it. Decomposing the raw local matrix against
 * bounds that have already been through `ctm` compares two different
 * coordinate spaces, and a rotation inside a translated `<g>` fails to
 * decompose for no reason but the offset.
 *
 * `null` when `@weasel-js/geom`'s `invert` finds `ctm` singular: the geometry
 * has collapsed through it, and the local transform has no frame to live in.
 */
export function rebaseTransform(ctm: Matrix, local: Matrix): Matrix | null {
  const inv = invert(ctm);
  if (!inv) return null;
  return multiply(multiply(ctm, local), inv);
}

/** Try to factor `m` as "rotation by theta about (cx, cy)". Returns the
 *  angle in radians when `m` is (within `eps`) a pure rotation about the
 *  given pivot. Returns `null` otherwise.
 *
 *  Pure rotation about (cx, cy) has the matrix form:
 *    [ cos  -sin   cx - cx*cos + cy*sin ]
 *    [ sin   cos   cy - cx*sin - cy*cos ]
 */
export function decomposeRotation(
  m: Matrix,
  cx: number,
  cy: number,
  eps = 1e-4,
): number | null {
  const [a, b, c, d, e, f] = m;
  // Pure rotation requires a == d and b == -c.
  if (Math.abs(a - d) > eps) return null;
  if (Math.abs(b + c) > eps) return null;
  // Determinant must be 1 (no scale, no flip).
  const det = a * d - b * c;
  if (Math.abs(det - 1) > eps) return null;
  const theta = Math.atan2(b, a);
  // Verify translation = (cx - cx*cos + cy*sin, cy - cx*sin - cy*cos).
  const expectedE = cx - cx * a + cy * b;
  const expectedF = cy - cx * b - cy * a;
  if (Math.abs(e - expectedE) > eps) return null;
  if (Math.abs(f - expectedF) > eps) return null;
  return theta;
}

/** Best-effort rotational-component extraction for a general matrix (any
 *  scale + rotation, ignoring translation). For a non-uniform matrix the
 *  "rotation" is ambiguous; we report atan2(b, a) which corresponds to where
 *  the +x basis vector points.
 */
export function rotationComponent(m: Matrix): number {
  return Math.atan2(m[1], m[0]);
}

/** Format a matrix as an SVG `matrix(a b c d e f)` value, or `null` when `m`
 *  is (effectively) the identity, so the caller can omit the attribute. */
export function formatMatrix(m: Matrix): string | null {
  if (isIdentity(m)) return null;
  return `matrix(${m.map((n) => trimNumber(n)).join(' ')})`;
}

/** Trim trailing zeros from a numeric value for compact SVG output. */
export function trimNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  // Round to ~6 decimal places to avoid floating-point cruft.
  const r = Math.round(n * 1e6) / 1e6;
  if (Number.isInteger(r)) return String(r);
  return String(r);
}
