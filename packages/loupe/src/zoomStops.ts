/** The least and greatest factor a lens's zoom control reaches. */
export const LOUPE_FACTOR_MIN = 1;
export const LOUPE_FACTOR_MAX = 64;
/** The factors a lens's zoom control stops at, and its zoom keys step through: every power of two between the two. */
export const LOUPE_FACTOR_STOPS: readonly number[] = Array.from(
  { length: Math.log2(LOUPE_FACTOR_MAX / LOUPE_FACTOR_MIN) + 1 },
  (_, i) => LOUPE_FACTOR_MIN * 2 ** i,
);

/** The index of the stop in `stops` nearest `factor`, measured in doublings, so 6× is as near 4× as 8×. */
export function nearestStopIndex(stops: readonly number[], factor: number): number {
  let best = 0;
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs(Math.log2(stops[i]! / factor)) < Math.abs(Math.log2(stops[best]! / factor))) best = i;
  }
  return best;
}
