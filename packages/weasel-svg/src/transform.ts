/**
 * SVG transform attribute helpers. Parses the four primitive transform
 * functions weasel-svg supports (`matrix`, `translate`, `scale`, `rotate`)
 * into a single 2x3 affine matrix, and exposes the point/path mappers we
 * need to collapse `transform=` onto leaf geometry at parse time.
 */

import type { Matrix } from './types';
import { IDENTITY_MATRIX } from './types';

/** Multiply two 2x3 affine matrices (a then b applied to a column vector). */
export function multiply(a: Matrix, b: Matrix): Matrix {
  // [a0 a2 a4] [b0 b2 b4]
  // [a1 a3 a5] [b1 b3 b5]
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** Apply a 2x3 affine to a 2D point. */
export function applyMatrix(m: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
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
 * Parse an SVG `transform="..."` string into a single 2x3 matrix.
 * Functions compose right-to-left in SVG's coordinate model: in
 * `transform="A B"`, the rightmost function is applied first to a point's
 * local coordinates. We accumulate accordingly: `result = result * fn`.
 *
 * Unrecognized functions emit a warning via the optional callback and are
 * skipped (the rest of the transform list still applies).
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
 * Format a matrix as an SVG `matrix(a b c d e f)` value. Returns `null`
 * when `m` is (effectively) the identity, so the caller can omit the
 * attribute entirely.
 */
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
