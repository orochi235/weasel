/** The multiples of `step` either side of `theta`, and the nearest: the
 *  angles an angle step offers a direction at `theta`. Radians. */
export function stepAngles(theta: number, step: number): number[] {
  const k = Math.round(theta / step);
  return [k - 1, k, k + 1].map((i) => i * step);
}
