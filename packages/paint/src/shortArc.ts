const TWO_PI = Math.PI * 2;

/** `dh` radians as the shorter arc, in [-π, π]: a half turn keeps its sign. NaN for NaN and ±∞.
 *  geom's `wrapAngle(dh, 'sign')`, kept here because paint does not depend on geom. */
export function shortArc(dh: number): number {
  const r = dh % TWO_PI;
  return r > Math.PI ? r - TWO_PI : r < -Math.PI ? r + TWO_PI : r;
}
