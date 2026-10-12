/**
 * Which copies of a periodic lattice a visible range touches: the integer
 * copies `k` whose cell overlaps `[visStart, visEnd]`. Copy `k` draws the
 * authored content shifted by `k * period`.
 */
export interface TileRange {
  /** First copy index, inclusive. */
  from: number;
  /** Last copy index, inclusive. `to < from` means nothing is visible. */
  to: number;
}

/** The copies of a lattice with cell size `period` that `[visStart, visEnd]`
 *  touches, widened by `bleed`. A non-positive or non-finite `period` answers
 *  copy 0 alone. */
export function tiledProject(
  visStart: number,
  visEnd: number,
  period: number,
  bleed = 0,
): TileRange {
  if (!Number.isFinite(period) || period <= 0) return { from: 0, to: 0 };
  return {
    from: Math.floor((visStart - bleed) / period),
    to: Math.floor((visEnd + bleed) / period),
  };
}
