import { clamp } from '../scalar';
import type { TrackPlace, TrackRun } from './run';

/** Where a sequence sits along a run: against its reading start, its middle, or its reading end. */
export type RunAlign = 'start' | 'center' | 'end';

/** The order {@link placeAlongRun} lays items in: along the run's reading order, or from the end where the underlying
 *  shape's own direction starts. The two differ only on a run that is `reversed`. */
export type RunOrder = 'reading' | 'track';

/** Where one item of a run falls: its center along the run, and how much of it lies past the run's ends. */
export interface RunSpot {
  center: number;
  clipped: 'none' | 'part' | 'past';
}

const clipOf = (lo: number, hi: number, start: number, end: number, hair = 0): RunSpot['clipped'] =>
  lo >= start - hair && hi <= end + hair ? 'none' : hi <= start + hair || lo >= end - hair ? 'past' : 'part';

/**
 * Where each item's center falls along a run `room` px long, gaps measured along it. Without `at`, a sequence that fits
 * sits as `align` says, and one that does not is laid from the start less `offset`. With `at`, the sequence's align
 * point sits at `at - offset` whether or not it fits.
 */
export function runPlaces(
  lengths: readonly number[],
  gap: number,
  room: number,
  align: RunAlign,
  offset: number,
  at?: number,
): RunSpot[] {
  const total = runLength(lengths, gap);
  const fits = at === undefined && total <= room;
  const lead = align === 'start' ? 0 : align === 'end' ? total : total / 2;
  let lo = at !== undefined ? at - offset - lead : !fits ? -offset : align === 'start' ? 0 : align === 'end' ? room - total : (room - total) / 2;
  return lengths.map((length) => {
    const start = lo;
    const hi = start + length;
    lo = hi + gap;
    return { center: start + length / 2, clipped: fits ? 'none' : clipOf(start, hi, 0, room) };
  });
}

/** How long items of `lengths` are laid end to end with `gap` between each two. */
export function runLength(lengths: readonly number[], gap: number): number {
  return lengths.reduce((sum, length, i) => sum + length + (i > 0 ? gap : 0), 0);
}

/** The place `distance` along `run`; past either end it carries on straight along that end, tipped as it is there. The
 *  point then moves `shift` along the place's up. */
export function runStationAt(run: TrackRun, distance: number, shift = 0): TrackPlace {
  const { length } = run;
  const place = run.at(length === 0 ? 0 : distance / length);
  const past = distance < 0 ? distance : distance > length ? distance - length : 0;
  const { point, tangent, normal } = place;
  return {
    ...place,
    point: { x: point.x + past * tangent.x + shift * normal.x, y: point.y + past * tangent.y + shift * normal.y },
  };
}

/** How {@link placeAlongRun} lays its items: spacing, alignment, offset, anchor, stand-off, wrap and past-end handling. */
export interface PlaceAlongRunOptions {
  /** Space between each two items, along the run. Default 0. */
  gap?: number;
  /** Default `'center'`. */
  align?: RunAlign;
  /** How far the sequence is laid back along the run. Default 0. */
  offset?: number;
  /** Where along the run the sequence's align point sits, fitting or not; see {@link runPlaces}. */
  at?: number;
  /** How far each item stands off the run, along its up. Default 0. */
  shift?: number;
  /** Carry items on round a closed run past its seam, and count an item past once it is a whole lap on from the first
   *  item's start. Default false. */
  wrap?: boolean;
  /** Where an item wholly past an end is placed: carried on beyond it (`'extend'`, the default) or held at it. */
  past?: 'extend' | 'hold';
  /** `'reading'` (the default) lays item 1 at the run's reading start. `'track'` lays it at the shape's own start and
   *  proceeds in the shape's direction; items still stand as the run reads them. In `'track'` order `align`, `at`,
   *  `offset` and each `center` are measured from the shape's start. */
  order?: RunOrder;
}

/** One item laid along a run: where its center falls and the place there. `center` is unwrapped. */
export interface RunPlace extends RunSpot, TrackPlace {}

/** Items of `lengths` laid end to end along `run`, each centered on its place and tipped to it. */
export function placeAlongRun(run: TrackRun, lengths: readonly number[], options: PlaceAlongRunOptions = {}): RunPlace[] {
  const { gap = 0, align = 'center', offset = 0, at, shift = 0, wrap = false, past = 'extend', order = 'reading' } = options;
  const { length } = run;
  const mirror = order === 'track' && run.reversed;
  const spots = runPlaces(lengths, gap, length, align, offset, at);
  const lap = wrap && run.closed && spots.length > 0 ? wrapWindow(spots[0]!, lengths[0]!, length) : null;
  return spots.map((spot, i) => {
    const half = lengths[i]! / 2;
    const clipped = lap ? clipOf(spot.center - half, spot.center + half, lap.start, lap.end, lap.hair) : spot.clipped;
    let distance = spot.center;
    if (past === 'hold' && clipped === 'past') distance = clamp(distance, lap?.start ?? 0, lap?.end ?? length);
    if (lap && length > 0) distance = ((distance % length) + length) % length;
    return { ...runStationAt(run, mirror ? length - distance : distance, shift), center: spot.center, clipped };
  });
}

/** The lap a wrapped sequence fills, from the first item's start. Items meet that lap's end exactly whenever they fill it,
 *  so it is judged within a `hair` of rounding error. */
function wrapWindow(first: RunSpot, firstLength: number, length: number) {
  const start = first.center - firstLength / 2;
  return { start, end: start + length, hair: 1e-9 * Math.max(1, length) };
}
