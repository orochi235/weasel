import type { Quantity } from '@weasel-js/quantity';
import type { BandScale } from './scale';
import { clamp01 } from './scale';

/** One band. `from` may be a tagged quantity, which keeps its display and
 *  unit through every edit: see `BandEditor`. */
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

/** How far seam `index` can travel before it would cross a neighbour. */
export function seamBounds<T>(
  bands: readonly Band<T>[],
  index: number,
  min: number,
  max: number,
): [number, number] {
  const lo = index === 0 ? min : bands[index].from;
  const hi = index + 2 <= bands.length - 1 ? bands[index + 2].from : max;
  return [lo, hi];
}

/** Clamps a target position for seam `index` to its neighbours, inclusive. */
export function clampSeamTo<T>(
  bands: readonly Band<T>[],
  index: number,
  to: number,
  min: number,
  max: number,
): number {
  const [lo, hi] = seamBounds(bands, index, min, max);
  return Math.max(lo, Math.min(hi, to));
}

export function setSeam<T>(bands: readonly Band<T>[], index: number, to: number): Band<T>[] {
  if (bands[index + 1] === undefined || bands[index + 1].from === to) return bands as Band<T>[];
  const next = bands.map((b) => ({ ...b }));
  next[index + 1].from = to;
  return next;
}

/** Band edges as track positions: `length + 1` values from 0 to 1. */
export function unitEdges<T>(
  bands: readonly Band<T>[],
  scale: BandScale,
  min: number,
  max: number,
): number[] {
  const edges = bands.map((b, i) => (i === 0 ? 0 : clamp01(scale.toUnit(b.from, min, max))));
  edges.push(1);
  return edges;
}

/**
 * Largest part of `shift` band `index` can take without pushing a neighbour's
 * far edge past it. Zero for the first and last band, whose outer edges are
 * `min` and `max` and do not move.
 */
export function clampBandShift(edges: readonly number[], index: number, shift: number): number {
  const isFirst = index === 0;
  const isLast = index === edges.length - 2;
  if (isFirst || isLast) return 0;
  const lo = edges[index - 1] - edges[index];
  const hi = edges[index + 2] - edges[index + 1];
  return Math.max(lo, Math.min(hi, shift));
}

/** Moves both edges of band `index`, which is the same as moving two seams. */
export function moveBandEdges<T>(
  bands: readonly Band<T>[],
  index: number,
  from: number,
  to: number,
): Band<T>[] {
  const next = bands.map((b) => ({ ...b }));
  next[index].from = from;
  if (next[index + 1] !== undefined) next[index + 1].from = to;
  return next;
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
 * until the unlocked bands have shrunk to nothing, outward to `limits`.
 */
export function edgeReach(
  edges: readonly number[],
  locked: readonly boolean[],
  edge: RangeEdge,
  limits: readonly [number, number] = [-Infinity, Infinity],
): [number, number] {
  const n = edges.length - 1;
  let lockedSpan = 0;
  for (let i = 0; i < n; i++) if (locked[i]) lockedSpan += edges[i + 1] - edges[i];
  const allLocked = locked.slice(0, n).every(Boolean);
  if (edge === 'min') {
    const inner = edges[n] - lockedSpan;
    return allLocked ? [inner, inner] : [Math.min(limits[0], inner), inner];
  }
  const inner = edges[0] + lockedSpan;
  return allLocked ? [inner, inner] : [inner, Math.max(limits[1], inner)];
}

/**
 * Band edges, in track units, after moving `edge` to `to` with the other end
 * held. Locked bands keep their length; the rest share what is left in
 * proportion to their current lengths, or equally if they are all empty.
 * `null` when nothing would change or the range would collapse to a point.
 */
export function scaleEdges(
  edges: readonly number[],
  locked: readonly boolean[],
  edge: RangeEdge,
  to: number,
  limits?: readonly [number, number],
): number[] | null {
  const n = edges.length - 1;
  const [lo, hi] = edgeReach(edges, locked, edge, limits);
  const at = Math.max(lo, Math.min(hi, to));
  const total = edge === 'min' ? edges[n] - at : at - edges[0];
  const current = edges[n] - edges[0];
  if (!(total > 0) || total === current) return null;
  let lockedSpan = 0;
  let freeSpan = 0;
  let freeCount = 0;
  for (let i = 0; i < n; i++) {
    const len = edges[i + 1] - edges[i];
    if (locked[i]) lockedSpan += len;
    else { freeSpan += len; freeCount++; }
  }
  const free = total - lockedSpan;
  const next = [edge === 'min' ? at : edges[0]];
  for (let i = 0; i < n; i++) {
    const len = edges[i + 1] - edges[i];
    const scaled = locked[i] ? len : freeSpan > 0 ? (len * free) / freeSpan : free / freeCount;
    next.push(next[i] + scaled);
  }
  if (edge === 'min') next[n] = edges[n];
  else next[n] = at;
  return next;
}
