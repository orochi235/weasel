/**
 * Common range filter used by offsetAt-style effects. `range` is `[start, end]` as
 * fractions of `totalCss` in `[0, 1]`, where `end > start` includes a single contiguous
 * segment and `end < start` wraps around the closing point of the perimeter. Returns
 * the multiplier 1 inside the range and 0 outside (no feather yet — kept simple).
 */
export function rangeMask(s: number, totalCss: number, range?: [number, number]): number {
  if (!range) return 1;
  const [a, b] = range;
  if (a === b) return 0;
  const u = (((s % totalCss) + totalCss) % totalCss) / totalCss;
  if (a < b) return u >= a && u <= b ? 1 : 0;
  // Wrapping range like [0.9, 0.1].
  return u >= a || u <= b ? 1 : 0;
}

export interface RangeMaskParams {
  /** Optional `[start, end]` as fractions of totalCss (0..1). Restricts the effect to a
   *  contiguous slice of the perimeter; `end < start` wraps around. */
  range?: [number, number];
}
