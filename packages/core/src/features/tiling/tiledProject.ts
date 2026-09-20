/**
 * Which copies of a periodic lattice a visible range touches.
 *
 * A tiled layer's content is authored once, in the cell `[0, period)`, and the
 * lattice repeats it at every multiple of `period`. This answers the only
 * question drawing it needs: the integer copies `k` whose cell overlaps
 * `[visStart, visEnd]`. Copy `k` draws the authored content shifted by
 * `k * period`.
 *
 * `bleed` is how far the content reaches outside its own cell, in world
 * units — the printing term, and the same idea. Content that overhangs by
 * more than it declares pops in at the edge of the view instead of scrolling
 * in.
 */
export interface TileRange {
  /** First copy index, inclusive. */
  from: number;
  /** Last copy index, inclusive. `to < from` means nothing is visible. */
  to: number;
}

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
