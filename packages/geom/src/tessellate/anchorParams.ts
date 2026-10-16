/**
 * The anchor parameters `(A, B, t)` of a point a fraction `frac` of the way
 * from one polyline point to the next: `t` interpolated when both lie between
 * the same two anchors, otherwise the nearer point's own.
 */
export function anchorParamsBetween(
  a0: number, b0: number, t0: number,
  a1: number, b1: number, t1: number,
  frac: number,
): [number, number, number] {
  if (a0 === a1 && b0 === b1) return [a0, b0, t0 + (t1 - t0) * frac];
  return frac < 0.5 ? [a0, b0, t0] : [a1, b1, t1];
}
