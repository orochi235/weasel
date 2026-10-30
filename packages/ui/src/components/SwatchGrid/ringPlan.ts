import { bendSide, shiftTrack, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { rowRun } from '../Along/rowRun';

/** One ring: the shape it lies on and the run its swatches read along. */
export interface SwatchRing {
  shape: TrackShape;
  run: TrackRun;
}

/** Which way along `shape`'s own normal is in: toward its center of curvature, or for a shape that does not bend, away
 *  from the side its items stand on, so rows stack down the way a grid's do. */
export function inwardSign(shape: TrackShape, run: TrackRun): 1 | -1 {
  return bendSide(shape) || (run.flipped ? 1 : -1);
}

/**
 * How many rings, their middles `depths` in from `shape`, may be laid with swatches `size` across and `gap` apart.
 * Ring k is laid while the shape shifted in to it and then `clear` more still does not fold, `clear` being the radius
 * at which two neighbors' inner corners just meet (only a pitch when they touch anyway, `gap` 0), and at least a
 * pitch. Ring 0 is always laid; every ring is, before a swatch has been measured.
 */
export function viableRings(shape: TrackShape, sign: 1 | -1, depths: readonly number[], size: number, gap: number): number {
  if (size <= 0) return depths.length;
  const clear = Math.max(size + gap, gap > 0 ? (size * (size + gap)) / (2 * gap) : 0);
  let k = 1;
  while (k < depths.length && shiftTrack(shape, sign * (depths[k]! + clear)) !== null) k++;
  return Math.min(k, depths.length);
}

/** How thick each ring is, palette by palette, `counts[i]` rings for palette i: a swatch across, or its lead's
 *  thickness on its first ring where that is more. */
export function ringThicknesses(counts: readonly number[], leads: readonly number[], size: number): number[] {
  return counts.flatMap((n, i) => Array.from({ length: n }, (_, k) => (k === 0 ? Math.max(size, leads[i] ?? 0) : size)));
}

/** How far in from the first ring each ring's middle lies, rings `thick` across with `gap` between each two. */
export function ringDepths(thick: readonly number[], gap: number): number[] {
  let depth = 0;
  return thick.map((t, k) => (k === 0 ? 0 : (depth += thick[k - 1]! / 2 + gap + t / 2)));
}

/**
 * The rings each of a run of palettes takes, given how many rows each has and how many rings there is room for. Each
 * takes as many as it has rows while room lasts, keeping one for every palette after it; what is left of a palette's
 * rows shares its last ring. Every palette takes at least one.
 */
export function ringPlan(rows: readonly number[], room: number): number[] {
  let left = room;
  return rows.map((n, i) => {
    const later = rows.length - 1 - i;
    const take = Math.max(1, Math.min(n, left - later));
    left -= take;
    return take;
  });
}

/** Rings in from `shape`, their middles `depths` in, each laid from the shape's own start, or from its end under `'rtl'`.
 *  A ring that would fold lies on the last one that does not. */
export function ringsOf(shape: TrackShape, depths: readonly number[], direction: 'ltr' | 'rtl' = 'ltr'): SwatchRing[] {
  const run = rowRun(shape, direction);
  const sign = inwardSign(shape, run);
  const side = run.flipped ? 'flipped' : 'path';
  const rings: SwatchRing[] = [];
  depths.forEach((depth, k) => {
    const moved = k === 0 ? shape : shiftTrack(shape, sign * depth);
    rings.push(moved ? { shape: moved, run: k === 0 ? run : rowRun(moved, direction, { side }) } : rings[k - 1]!);
  });
  return rings;
}
