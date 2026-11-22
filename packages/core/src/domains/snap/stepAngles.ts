/** The multiples of `step` either side of `theta`, and the nearest: the
 *  angles an angle step offers a direction at `theta`. Radians. Throws unless
 *  `step` is finite and nonzero. */
export function stepAngles(theta: number, step: number): number[] {
  if (!Number.isFinite(step) || step === 0) throw new RangeError(`stepAngles: step must be finite and nonzero, got ${step}`);
  const k = Math.round(theta / step);
  return [k - 1, k, k + 1].map((i) => i * step);
}
