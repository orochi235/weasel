/** Angle units and wrapping: one definition of each, so callers agree on where a half turn lands. */

const TAU = Math.PI * 2;

/** Multiply degrees by this to get radians. */
export const DEG_TO_RAD = Math.PI / 180;

/** Multiply radians by this to get degrees. */
export const RAD_TO_DEG = 180 / Math.PI;

/**
 * Where {@link wrapAngle} puts a half turn, the one angle with two names:
 * `'max'` at `π`, `'min'` at `-π`, and `'sign'` at whichever of the two has
 * the input's sign, so `-3π` stays a turn the negative way.
 */
export type HalfTurn = 'max' | 'min' | 'sign';

/**
 * `a` radians as the turn of at most half a circle that reaches it, in
 * `(-π, π]` by default. `half` picks the closed end (see {@link HalfTurn}).
 * `NaN` and infinities give `NaN`.
 */
export function wrapAngle(a: number, half: HalfTurn = 'max'): number {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  else if (r < -Math.PI) r += TAU;
  if (r === Math.PI) return half === 'min' ? -Math.PI : r;
  if (r === -Math.PI) return half === 'max' ? Math.PI : r;
  return r;
}

/**
 * `a` in `[0, period)`: radians by default, `wrapPositive(deg, 360)` for
 * degrees. Never returns `period` itself, however close to zero a negative
 * `a` is. `NaN` and infinities give `NaN`.
 */
export function wrapPositive(a: number, period: number = TAU): number {
  return ((a % period) + period) % period;
}
