/**
 * SVG transform attribute helpers: parses a `transform` list into a single 2x3
 * affine matrix, and exposes the mappers that collapse `transform=` onto leaf
 * geometry at parse time.
 */

import { DEG_TO_RAD, applyToPoint, invert, multiply, trimNumber } from '@weasel-js/geom';
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

/** One argument and the comma-wsp before it. SVG's number grammar lets two numbers abut where the
 *  second cannot continue the first, as minifiers write them: `1-2` is 1, -2 and `.5.5` is .5, .5. */
const ARG = /(\s*,\s*|\s*)([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/y;
const FUNCTION = /\s*([A-Za-z]+)\s*\(([^)]*)\)\s*,?/y;

/** How many arguments each function takes. */
const ARITY: Readonly<Record<string, readonly number[]>> = {
  matrix: [6], translate: [1, 2], scale: [1, 2], rotate: [1, 3], skewx: [1], skewy: [1],
};

/** A function's arguments, or `null` when one is not a finite number. */
function readNumbers(args: string): number[] | null {
  const s = args.trim();
  const nums: number[] = [];
  ARG.lastIndex = 0;
  while (ARG.lastIndex < s.length) {
    const first = ARG.lastIndex === 0;
    const m = ARG.exec(s);
    if (m === null || (first && m[1] !== '')) return null;
    nums.push(Number(m[2]));
  }
  return nums.every(Number.isFinite) ? nums : null;
}

function functionMatrix(name: string, nums: readonly number[]): Matrix {
  switch (name) {
    case 'matrix': return [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
    case 'translate': return [1, 0, 0, 1, nums[0], nums[1] ?? 0];
    case 'scale': return [nums[0], 0, 0, nums[1] ?? nums[0], 0, 0];
    case 'rotate': {
      const ang = nums[0] * DEG_TO_RAD;
      const rot: Matrix = [Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), 0, 0];
      if (nums.length < 3) return rot;
      // rotate(angle, cx, cy) = translate(cx,cy) * rotate * translate(-cx,-cy)
      return multiply(multiply([1, 0, 0, 1, nums[1], nums[2]], rot), [1, 0, 0, 1, -nums[1], -nums[2]]);
    }
    default: {
      const t = Math.tan(nums[0] * DEG_TO_RAD);
      return name === 'skewx' ? [1, 0, t, 1, 0, 0] : [1, t, 0, 1, 0, 0];
    }
  }
}

/**
 * Parse an SVG `transform="..."` string into a single 2x3 matrix. In
 * `transform="A B"`, the rightmost function is applied first to a point's
 * local coordinates. A list that does not parse whole (an unknown function, a
 * function with the wrong number of arguments, an argument that is not a
 * number, or text between functions) is ignored whole, as browsers ignore it,
 * with a warning.
 */
export function parseTransform(
  attr: string | null | undefined,
  onWarn?: (message: string) => void,
): Matrix {
  if (!attr || attr.trim() === '' || attr.trim() === 'none') return IDENTITY_MATRIX;
  let result: Matrix = IDENTITY_MATRIX;
  FUNCTION.lastIndex = 0;
  while (FUNCTION.lastIndex < attr.length && attr.slice(FUNCTION.lastIndex).trim() !== '') {
    const match = FUNCTION.exec(attr);
    if (match === null) {
      onWarn?.(`transform "${attr}" is not a transform list; it is ignored`);
      return IDENTITY_MATRIX;
    }
    const name = match[1].toLowerCase();
    const arity = ARITY[name];
    if (arity === undefined) {
      onWarn?.(`unsupported transform function: ${match[1]}; transform "${attr}" is ignored`);
      return IDENTITY_MATRIX;
    }
    const nums = readNumbers(match[2]);
    if (nums === null || !arity.includes(nums.length)) {
      onWarn?.(`transform "${attr}" has ${match[1]}(${match[2].trim()}), which takes ${arity.join(' or ')} numbers; it is ignored`);
      return IDENTITY_MATRIX;
    }
    result = multiply(result, functionMatrix(name, nums));
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

export { trimNumber };
