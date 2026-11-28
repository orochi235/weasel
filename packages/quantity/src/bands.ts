import type { Quantity } from './quantity';

/** One band. `from` may be a tagged quantity, which keeps its display and
 *  unit through every edit, as `BandEditor` in `@weasel-js/ui` does. */
export interface Band<T, F extends Quantity = number> {
  /** Domain value where this band starts. The first band's is normalized to `min`. */
  from: F;
  data: T;
  /** Holds this band's drawn length when the whole range is rescaled. Other edits ignore it. */
  locked?: boolean;
}

/**
 * A band list covers `[min, max]` exactly: N bands, N−1 interior seams, no
 * gaps and no overlaps. Seam *k* is `bands[k + 1].from`, and lives between
 * `bands[k].from` and the start of the band after next (or `max`).
 *
 * Every function here preserves that. Each returns the array it was given
 * when the edit would be a no-op, so callers can skip a callback with `===`.
 */

/** Pins the first band's start to `min`; leaves the rest alone. */
export function normalizeBands<T>(value: readonly Band<T>[], min: number): Band<T>[] {
  const bands = value.map((b) => ({ ...b }));
  if (bands.length > 0) bands[0].from = min;
  return bands;
}

/** `[from, to]` of band `index` in domain space. */
export function bandBounds<T>(
  bands: readonly Band<T>[],
  index: number,
  min: number,
  max: number,
): [number, number] {
  const from = index === 0 ? min : bands[index].from;
  const to = index === bands.length - 1 ? max : bands[index + 1].from;
  return [from, to];
}

/**
 * Index of the band holding `value`: the last whose start is at or below it, so a value on a seam belongs to
 * the band after it. A value below `min` gets the first band and one past `max` the last; NaN gets −1.
 */
export function bandIndexAt<T>(bands: readonly Band<T>[], value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return -1;
  for (let i = bands.length - 1; i > 0; i--) if (bandBounds(bands, i, min, max)[0] <= value) return i;
  return bands.length > 0 ? 0 : -1;
}

/** `bands` with seam *k* moved to `seams[k]`, each band keeping its payload and lock. */
export function withSeams<T>(bands: readonly Band<T>[], seams: readonly number[]): Band<T>[] {
  return bands.map((b, i) => (i === 0 ? { ...b } : { ...b, from: seams[i - 1]! }));
}

/**
 * Splits the band containing `at` in two, the new band starting there.
 * A position already on a seam or on `min` / `max` splits nothing.
 */
export function splitBands<T>(
  bands: readonly Band<T>[],
  at: number,
  min: number,
  max: number,
  makeData: (at: number, from: T) => T,
): Band<T>[] {
  if (bands.length === 0 || at <= min || at >= max) return bands as Band<T>[];
  let index = -1;
  for (let i = 0; i < bands.length; i++) {
    const [from, to] = bandBounds(bands, i, min, max);
    if (at > from && at < to) {
      index = i;
      break;
    }
  }
  if (index < 0) return bands as Band<T>[];
  const next = bands.map((b) => ({ ...b }));
  next.splice(index + 1, 0, { from: at, data: makeData(at, bands[index].data) });
  return next;
}

/**
 * Merges band `index` into its left neighbour, which keeps its payload and
 * absorbs the span. The first band has no left neighbour and cannot be
 * merged away — a partition always has at least one part.
 */
export function mergeBand<T>(bands: readonly Band<T>[], index: number): Band<T>[] {
  if (index <= 0 || index >= bands.length) return bands as Band<T>[];
  return bands.filter((_, i) => i !== index).map((b) => ({ ...b }));
}

/** One end of the whole range: `min` or `max`. */
export type RangeEdge = 'min' | 'max';

/** Flips band `index`'s lock. */
export function toggleLock<T>(bands: readonly Band<T>[], index: number): Band<T>[] {
  if (bands[index] === undefined) return bands as Band<T>[];
  return bands.map((b, i) => {
    if (i !== index) return { ...b };
    const { locked, ...rest } = b;
    return locked ? rest : { ...rest, locked: true };
  });
}

/**
 * How far `edge` can travel, in track units, with the other end held: inward
 * until the unlocked bands have shrunk to nothing, or the range to `minSpan`
 * if that is longer, and outward to `limits`.
 */
export function edgeReach(
  edges: readonly number[],
  locked: readonly boolean[],
  edge: RangeEdge,
  limits: readonly [number, number] = [-Infinity, Infinity],
  minSpan = 0,
): [number, number] {
  const n = edges.length - 1;
  let lockedSpan = 0;
  for (let i = 0; i < n; i++) if (locked[i]) lockedSpan += edges[i + 1] - edges[i];
  lockedSpan = Math.max(lockedSpan, minSpan);
  const allLocked = locked.slice(0, n).every(Boolean);
  // With every band locked the edge stays put: the locked lengths' sum can round off where it stands.
  if (edge === 'min') {
    const inner = edges[n] - lockedSpan;
    return allLocked ? [edges[0], edges[0]] : [Math.min(limits[0], inner), inner];
  }
  const inner = edges[0] + lockedSpan;
  return allLocked ? [edges[n], edges[n]] : [inner, Math.max(limits[1], inner)];
}

/**
 * Band edges, in track units, after moving `edge` to `to` with the other end
 * held, no shorter than `minSpan`. Locked bands keep their length; the rest share what is left in
 * proportion to their current lengths, or equally if they are all empty.
 * Returns `edges` itself when nothing would change, and `null` when the range
 * would collapse to a point.
 */
export function scaleEdges(
  edges: readonly number[],
  locked: readonly boolean[],
  edge: RangeEdge,
  to: number,
  limits?: readonly [number, number],
  minSpan = 0,
): readonly number[] | null {
  const n = edges.length - 1;
  const [lo, hi] = edgeReach(edges, locked, edge, limits, minSpan);
  const at = Math.max(lo, Math.min(hi, to));
  const total = edge === 'min' ? edges[n] - at : at - edges[0];
  const current = edges[n] - edges[0];
  if (!(total > 0)) return null;
  if (total === current) return edges;
  let lockedSpan = 0;
  let freeSpan = 0;
  let freeCount = 0;
  for (let i = 0; i < n; i++) {
    const len = edges[i + 1] - edges[i];
    if (locked[i]) lockedSpan += len;
    else { freeSpan += len; freeCount++; }
  }
  const free = total - lockedSpan;
  const scaled = (i: number): number => {
    const len = edges[i + 1] - edges[i];
    return locked[i] ? len : freeSpan > 0 ? (len * free) / freeSpan : free / freeCount;
  };
  // Built out from the held end, where a run of locked bands keeps its edges exactly rather than summed back up.
  const next = new Array<number>(n + 1);
  if (edge === 'max') {
    next[0] = edges[0];
    for (let i = 0; i < n; i++) next[i + 1] = locked[i] && next[i] === edges[i] ? edges[i + 1] : next[i] + scaled(i);
    next[n] = at;
  } else {
    next[n] = edges[n];
    for (let i = n - 1; i >= 0; i--) next[i] = locked[i] && next[i + 1] === edges[i + 1] ? edges[i] : next[i + 1] - scaled(i);
    next[0] = at;
  }
  return next;
}
