import { lerp } from '../scalar';

/**
 * The anchor parameters `(A, B, t)` of a point a fraction `frac` of the way
 * from one polyline point to the next. `t` is interpolated when both lie on
 * one anchor pair, counting an anchor-aligned point (`A === B`) as `t = 0` at
 * its anchor or `t = 1` at the other's far end; otherwise, and at either end
 * itself, the nearer point's.
 */
export function anchorParamsBetween(
  a0: number, b0: number, t0: number,
  a1: number, b1: number, t1: number,
  frac: number,
): [number, number, number] {
  if (a0 === a1 && b0 === b1) return [a0, b0, lerp(t0, t1, frac)];
  if (frac <= 0) return [a0, b0, t0];
  if (frac >= 1) return [a1, b1, t1];
  const exact0 = a0 === b0, exact1 = a1 === b1;
  if (exact0 && exact1) return [a0, a1, frac];
  if (exact0 && a0 === a1) return [a1, b1, lerp(0, t1, frac)];
  if (exact0 && a0 === b1) return [a1, b1, lerp(1, t1, frac)];
  if (exact1 && a1 === b0) return [a0, b0, lerp(t0, 1, frac)];
  if (exact1 && a1 === a0) return [a0, b0, lerp(t0, 0, frac)];
  return frac < 0.5 ? [a0, b0, t0] : [a1, b1, t1];
}
