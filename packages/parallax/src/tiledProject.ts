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
  const start = visStart - bleed;
  const end = visEnd + bleed;
  let from = Math.floor(start / period);
  let to = Math.floor(end / period);
  // The quotient rounds, so a cell can start a hair past the range or end a hair short of it:
  // test the products the copies are placed at.
  if (from * period > start) from--;
  else if ((from + 1) * period <= start) from++;
  if (to * period > end) to--;
  else if ((to + 1) * period <= end) to++;
  return { from: from + 0, to: to + 0 };
}
