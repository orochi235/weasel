/**
 * Where each rank's band sits along the rank axis once pins are held: every
 * band covering the pins in its rank, at least as deep as its deepest node,
 * and every gap at least its least. A rank with pins slides or deepens its
 * band to cover them; the gaps between two such ranks share what room is left
 * in proportion to the room they would have had.
 */

/** What {@link placeBands} reads, along the rank axis. */
export interface BandInput {
  /** Each rank's deepest node. */
  natural: readonly number[];
  /** Between each rank and the next, with no pins held. */
  gaps: readonly number[];
  /** The least each gap may shrink to. */
  minGaps: readonly number[];
  /** The rank whose band the rest are laid out from, and where its band
   *  starts with no pins held. */
  home: { rank: number; lo: number };
}

/** The low and high edge of what a rank's pins take along the rank axis. */
export interface Cover {
  lo: number;
  hi: number;
}

/** Each rank's band. */
export interface Placed {
  los: number[];
  his: number[];
}

const EPS = 1e-6;

/**
 * Bands covering `covers`, keyed by rank, or `undefined` when none can: some
 * rank's pins sit nearer the pins of another rank than the bands between
 * them and their least gaps take, so covering both would overlap two ranks.
 */
export function placeBands(input: BandInput, covers: ReadonlyMap<number, Cover>): Placed | undefined {
  const { natural, minGaps } = input;
  const n = natural.length;
  const hiOf = (k: number, lo: number) => Math.max(lo + natural[k]!, covers.get(k)?.hi ?? -Infinity);

  // The earliest each band can start, every gap at its least: no band can
  // start later than its pins, so this is the whole test of whether any fits.
  const earliest: number[] = [];
  for (let k = 0, lo = -Infinity; k < n; k++) {
    earliest.push(lo);
    const cover = covers.get(k);
    if (cover !== undefined && lo > cover.lo + EPS) return undefined;
    lo = hiOf(k, lo) + (minGaps[k] ?? 0);
  }

  const los = preferred(input, covers, hiOf).map((lo, k) => Math.max(lo, earliest[k]!));
  for (let k = n - 1; k >= 0; k--) {
    if (k < n - 1) los[k] = Math.min(los[k]!, los[k + 1]! - minGaps[k]! - natural[k]!);
    const cover = covers.get(k);
    if (cover !== undefined) los[k] = Math.min(los[k]!, cover.lo);
  }
  return spread(input, covers, los, hiOf);
}

/** Each band where the default gaps put it outward from the home rank, slid
 *  just far enough to cover the pins in its rank. */
function preferred(input: BandInput, covers: ReadonlyMap<number, Cover>, hiOf: (k: number, lo: number) => number): number[] {
  const { natural, gaps, home } = input;
  const cover = (k: number, lo: number) => {
    const c = covers.get(k);
    return c === undefined ? lo : Math.min(c.lo, Math.max(lo, c.hi - natural[k]!));
  };
  const los: number[] = [];
  los[home.rank] = cover(home.rank, home.lo);
  for (let k = home.rank + 1; k < natural.length; k++) los[k] = cover(k, hiOf(k - 1, los[k - 1]!) + gaps[k - 1]!);
  for (let k = home.rank - 1; k >= 0; k--) los[k] = cover(k, los[k + 1]! - gaps[k]! - natural[k]!);
  return los;
}

/**
 * Keep the bands of ranks with pins where `los` puts them, and lay the rest
 * out again: past the outermost ones at the default gaps, and between two of
 * them sharing the room left among the gaps there, each above its least in
 * proportion to what it has above its least by default.
 */
function spread(input: BandInput, covers: ReadonlyMap<number, Cover>, los: number[], hiOf: (k: number, lo: number) => number): Placed {
  const { natural, gaps, minGaps } = input;
  const n = natural.length;
  const held = [...covers.keys()].sort((p, q) => p - q);
  const first = held[0]!;
  const last = held[held.length - 1]!;
  for (let k = first - 1; k >= 0; k--) los[k] = los[k + 1]! - gaps[k]! - natural[k]!;
  for (let k = last + 1; k < n; k++) los[k] = hiOf(k - 1, los[k - 1]!) + gaps[k - 1]!;
  for (let h = 1; h < held.length; h++) {
    const [f, g] = [held[h - 1]!, held[h]!];
    if (g === f + 1) continue;
    let room = los[g]! - hiOf(f, los[f]!);
    for (let k = f + 1; k < g; k++) room -= natural[k]!;
    const ks = Array.from({ length: g - f }, (_, i) => f + i);
    const least = ks.reduce((sum, k) => sum + minGaps[k]!, 0);
    const usual = ks.reduce((sum, k) => sum + gaps[k]!, 0);
    const share = (k: number): number => {
      if (room >= usual) return gaps[k]! + (usual > 0 ? ((room - usual) * gaps[k]!) / usual : (room - usual) / ks.length);
      const slack = usual - least;
      return minGaps[k]! + (slack > EPS ? ((room - least) * (gaps[k]! - minGaps[k]!)) / slack : (room - least) / ks.length);
    };
    for (let k = f + 1; k < g; k++) los[k] = hiOf(k - 1, los[k - 1]!) + share(k - 1);
  }
  return { los, his: los.map((lo, k) => hiOf(k, lo)) };
}
